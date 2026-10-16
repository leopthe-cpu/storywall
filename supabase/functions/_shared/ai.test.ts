import { assertEquals } from 'jsr:@std/assert@1';
import { parseJsonContent } from './openrouter.ts';
import { cleanImagePrompt } from './imagePrompt.ts';
import { buildPrompt, runStructurePipeline } from '../structureStory/pipeline.ts';
import { dropRepeatedTitles, findMissing, normalize, removeInventedBody, restoreMissing, userSentences } from '../structureStory/coverage.ts';
import { extractJsonArray, matchKeywordSkills } from '../suggestSkills/rules.ts';

Deno.test('parseJsonContent: plain, fenced, wrapped in text, invalid', () => {
  assertEquals(parseJsonContent('{"a":1}'), { a: 1 });
  assertEquals(parseJsonContent('```json\n{"a":1}\n```'), { a: 1 });
  assertEquals(parseJsonContent('Here you go: {"a":1} done'), { a: 1 });
  assertEquals(parseJsonContent('nope'), null);
  assertEquals(parseJsonContent(undefined), null);
});

Deno.test('buildPrompt: lists every attachment, sends only images as pictures', () => {
  const parts = buildPrompt('My story.', [
    { type: 'image', imageUrl: 'https://x/a.png' },
    { type: 'video', imageUrl: null },
  ]);
  assertEquals(parts.length, 2);
  const text = (parts[0] as { text: string }).text;
  assertEquals(text.includes('[Attachment 0: image]'), true);
  assertEquals(text.includes('[Attachment 1: video]'), true);
  assertEquals(parts[1], { type: 'image_url', image_url: { url: 'https://x/a.png' } });
});

const card = (text: string | null, subtitle: string | null) => ({
  text, subtitle, needsImage: false, imagePrompt: null, grade: 'warm', shotType: 'object',
  isBookend: false, attachmentIndex: null,
});

// A fake AI: answers each structuring call from a queue.
function fakeChat(structures: unknown[]) {
  const calls: string[] = [];
  // deno-lint-ignore no-explicit-any
  const chat = (opts: any) => {
    calls.push(opts.name);
    return Promise.resolve({ data: structuredClone(structures.shift()), cost: 0.001, model: opts.model });
  };
  return { chat, calls };
}

const STORY = 'I wasn’t convinced. I spent two weeks calling customers. The problem wasn’t marketing. It was trust.';

Deno.test('pipeline: a word-for-word answer is accepted in one call', async () => {
  const { chat, calls } = fakeChat([{
    cards: [card('Why they left', null), card('I wasn’t convinced.', 'I spent two weeks calling customers.'),
      card(null, 'The problem wasn’t marketing. It was trust.')],
  }]);
  // deno-lint-ignore no-explicit-any
  const res = await runStructurePipeline({ text: STORY, attachments: [], model: 'm', chat: chat as any });
  assertEquals(calls, ['structured_story']);
  assertEquals(res.attempts, 1);
  assertEquals(res.structured?.cards.length, 3);
});

Deno.test('pipeline: reworded body is removed, retried once, then the original is put back in place', async () => {
  const { chat, calls } = fakeChat([
    { cards: [card('Hook', 'I wasn’t convinced. I called customers for two weeks.'), card(null, 'It was trust.')] },
    { cards: [card('Hook', 'I wasn’t convinced. I called customers for two weeks.'), card(null, 'It was trust.')] },
  ]);
  // deno-lint-ignore no-explicit-any
  const res = await runStructurePipeline({ text: STORY, attachments: [], model: 'm', chat: chat as any });
  assertEquals(calls, ['structured_story', 'structured_story']);
  assertEquals(res.attempts, 2);
  // The paraphrase is gone; both missing sentences are back after their neighbour.
  assertEquals(res.structured?.cards[0].subtitle, 'I wasn’t convinced. I spent two weeks calling customers. The problem wasn’t marketing.');
  assertEquals(res.structured?.cards[1].subtitle, 'It was trust.');
});

Deno.test('pipeline: unusable answer returns no structure', async () => {
  const { chat } = fakeChat([{ cards: [] }]);
  // deno-lint-ignore no-explicit-any
  const res = await runStructurePipeline({ text: 'x', attachments: [], model: 'm', chat: chat as any });
  assertEquals(res.structured, null);
});

Deno.test('skills: keyword fast-path and answer parsing (Base44 rules)', () => {
  assertEquals(
    matchKeywordSkills('I negotiated with every stakeholder', 5, new Set(['negotiation'])),
    ['Stakeholder Management'],
  );
  assertEquals(extractJsonArray('Thinking...\n["Data Analysis", " UX Design "]'), ['Data Analysis', 'UX Design']);
  assertEquals(extractJsonArray(''), []);
});

Deno.test('coverage: sentences, curly quotes and whitespace', () => {
  assertEquals(userSentences('One. Two!\nThree line\nFour?'), ['One.', 'Two!', 'Three line', 'Four?']);
  assertEquals(normalize('It’s  “fine”'), 'It\'s "fine"');
  // A sentence split between title and body of the same card still counts.
  assertEquals(findMissing('Within two months, it worked.', [card('Within two months,', 'it worked.')]), []);
  assertEquals(findMissing('A. B.', [card(null, 'A.')]), ['B.']);
});

Deno.test('coverage: invented body text is removed, titles are left alone', () => {
  const cards = [card('My own hook', 'A real sentence. An invented one.')];
  assertEquals(removeInventedBody('A real sentence. Another.', cards), 1);
  assertEquals(cards[0].subtitle, 'A real sentence.');
  assertEquals(cards[0].text, 'My own hook');
  // A fragment of a sentence that was cut in two is removed (the whole
  // sentence is restored later); a title + body pair forming one sentence stays.
  const split = [card(null, 'They left.'), card(null, 'and nobody told them.'), card('Within two months,', 'it worked.')];
  assertEquals(removeInventedBody('They left, and nobody told them. Within two months, it worked.', split), 2);
  assertEquals(split[2].subtitle, 'it worked.');
});

Deno.test('coverage: restore keeps order and the user\'s exact characters', () => {
  const text = 'First “one”. Second. Third.';
  const cards = [card(null, 'First “one”.'), card(null, 'Third.')];
  restoreMissing(text, cards);
  assertEquals(cards[0].subtitle, 'First “one”. Second.');
  assertEquals(findMissing(text, cards), []);
});

Deno.test('coverage: a title that is a piece of a sentence shown in full is dropped', () => {
  const text = 'So I pitched a small fix: a message. It was trust.';
  const cards = [card('So I pitched a small fix:', null), card('A nine-day fix', 'So I pitched a small fix: a message.'), card('It was trust.', null)];
  dropRepeatedTitles(text, cards);
  assertEquals(cards.map((c) => c.text), [null, 'A nine-day fix', 'It was trust.']);
});

Deno.test('cleanImagePrompt: keeps clean prompts, strips people, refuses what is left empty', () => {
  assertEquals(cleanImagePrompt('A grocery bag on a doorstep, warm light.'), 'A grocery bag on a doorstep, warm light.');
  assertEquals(
    cleanImagePrompt('A warehouse aisle at dawn. A man smiling at the camera.'),
    'A warehouse aisle at dawn. Objects, places and details only.',
  );
  assertEquals(cleanImagePrompt('Portrait of a woman.'), null);
  assertEquals(cleanImagePrompt(''), null);
  assertEquals(cleanImagePrompt(null), null);
  // Whole words only: "manager" and "eyeglass" are not people.
  assertEquals(cleanImagePrompt('A manager desk with eyeglasses.'), 'A manager desk with eyeglasses.');
});
