import { assertEquals } from 'jsr:@std/assert@1';
import { parseJsonContent } from './openrouter.ts';
import { buildPrompt, runStructurePipeline } from '../structureStory/pipeline.ts';
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

// A fake AI: answers the structuring and checking calls from two queues.
function fakeChat(structures: unknown[], checks: unknown[]) {
  const calls: string[] = [];
  // deno-lint-ignore no-explicit-any
  const chat = (opts: any) => {
    calls.push(opts.name);
    const data = opts.name === 'structured_story' ? structures.shift() : checks.shift();
    return Promise.resolve({ data: structuredClone(data), cost: 0.001, model: opts.model });
  };
  return { chat, calls };
}

Deno.test('pipeline: clean first attempt, title correction applied', async () => {
  const { chat, calls } = fakeChat(
    [{ framework: 'STAR', cards: [card('Hook', 'Body one.'), card(null, 'Body two.')] }],
    [{ missingSentences: [], titleCorrections: [{ cardIndex: 0, newTitle: 'Body one' }] }],
  );
  // deno-lint-ignore no-explicit-any
  const res = await runStructurePipeline({ text: 'x', attachments: [], model: 'm', chat: chat as any });
  assertEquals(calls, ['structured_story', 'verification']);
  assertEquals(res.attempts, 1);
  assertEquals(res.structured?.cards[0].text, 'Body one');
  assertEquals(Math.round(res.cost * 1000), 2);
});

Deno.test('pipeline: retries once, then appends still-missing sentences to the last card', async () => {
  const { chat, calls } = fakeChat(
    [
      { cards: [card('A', 'One.')] },
      { cards: [card('A', 'One.'), card('B', 'Two.')] },
    ],
    [
      { missingSentences: ['Two.', 'Three.'], titleCorrections: [] },
      { missingSentences: ['Three.'], titleCorrections: [] },
    ],
  );
  // deno-lint-ignore no-explicit-any
  const res = await runStructurePipeline({ text: 'x', attachments: [], model: 'm', chat: chat as any });
  assertEquals(calls, ['structured_story', 'verification', 'structured_story', 'verification']);
  assertEquals(res.attempts, 2);
  assertEquals(res.structured?.cards[1].subtitle, 'Two. Three.');
});

Deno.test('pipeline: unusable answer returns no structure', async () => {
  const { chat } = fakeChat([{ cards: [] }], []);
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
