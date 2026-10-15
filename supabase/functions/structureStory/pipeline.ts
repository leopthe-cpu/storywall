import type { chatJson, ContentPart } from '../_shared/openrouter.ts';
import { SYSTEM_PROMPT } from './prompts.ts';
import { dropRepeatedTitles, findMissing, removeInventedBody, restoreMissing } from './coverage.ts';

// Structuring steps:
//   1. the AI structures the story into cards;
//   2. plain code checks the result word for word (coverage.ts): body text
//      the user didn't write is removed, and every sentence the user wrote
//      must appear unchanged;
//   3. if sentences are missing, one retry with them listed as feedback;
//      whatever is still missing is put back next to its neighbour, so
//      nothing the user wrote is ever lost or reworded.
// Base44 used a second AI call for step 2; a code check is exact, and saves
// a call per run. The AI call is passed in, so the steps can be tested
// without the network.

const nullable = (type: string) => ({ type: [type, 'null'] });

// Same fields as Base44's RESPONSE_SCHEMA. Written for strict mode: every
// field is listed as required and may be null where Base44 allowed it to be
// missing.
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    framework: { type: 'string' },
    styleTemplate: { type: 'string' },
    styleSelectionReason: { type: 'string' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: nullable('string'),
          subtitle: nullable('string'),
          needsImage: { type: 'boolean' },
          imagePrompt: nullable('string'),
          grade: { type: 'string' },
          shotType: { type: 'string' },
          isBookend: { type: 'boolean' },
          attachmentIndex: nullable('number'),
        },
        required: [
          'text', 'subtitle', 'needsImage', 'imagePrompt', 'grade', 'shotType', 'isBookend',
          'attachmentIndex',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['framework', 'styleTemplate', 'styleSelectionReason', 'cards'],
  additionalProperties: false,
};

export type Attachment = { type: string; imageUrl: string | null };
type Card = { text: string | null; subtitle: string | null; [k: string]: unknown };
type Structured = { framework?: string; styleTemplate?: string; cards: Card[]; [k: string]: unknown };

// Same prompt text Base44 built, as one user message. Image attachments are
// also sent as pictures the model can look at (Base44 passed file_urls).
export function buildPrompt(text: string, attachments: Attachment[], feedback?: string): ContentPart[] {
  let prompt = SYSTEM_PROMPT + '\n\n--- USER STORY ---\n' + text;
  if (attachments.length > 0) {
    prompt += '\n\n--- ATTACHED MEDIA ---\n';
    attachments.forEach((a, i) => {
      prompt += `[Attachment ${i}: ${a.type || 'image'}]\n`;
    });
    prompt += 'Cards that should use these attachments have attachmentIndex set to the corresponding index. Do not generate replacement images for attached media.';
  }
  if (feedback) prompt += '\n\n--- CORRECTION FROM PREVIOUS ATTEMPT ---\n' + feedback;
  const parts: ContentPart[] = [{ type: 'text', text: prompt }];
  for (const a of attachments) {
    if (a.imageUrl) parts.push({ type: 'image_url', image_url: { url: a.imageUrl } });
  }
  return parts;
}

export async function runStructurePipeline(opts: {
  text: string;
  attachments: Attachment[];
  model: string;
  chat: typeof chatJson;
}): Promise<{ structured: Structured | null; attempts: number; cost: number }> {
  const { text, attachments, model, chat } = opts;
  let cost = 0;
  const addCost = (c: number | null) => {
    if (typeof c === 'number') cost += c;
  };

  const MAX_ATTEMPTS = 2;
  let feedback: string | undefined;
  let attempt = 0;
  let structured: Structured | null = null;

  while (attempt < MAX_ATTEMPTS) {
    const res = await chat({
      model,
      name: 'structured_story',
      schema: RESPONSE_SCHEMA,
      user: buildPrompt(text, attachments, feedback),
    });
    addCost(res.cost);
    structured = res.data as Structured;
    if (!structured || !Array.isArray(structured.cards) || structured.cards.length === 0) {
      return { structured: null, attempts: attempt + 1, cost };
    }

    removeInventedBody(text, structured.cards);
    const missing = findMissing(text, structured.cards);

    if (missing.length > 0 && attempt < MAX_ATTEMPTS - 1) {
      feedback = `Your previous attempt left out or reworded these sentences from the user's text. Each must appear in a card exactly as written, character for character:\n` +
        missing.map((m, i) => `${i + 1}. "${m}"`).join('\n') +
        `\n\nRestructure the story so every sentence of the user's text appears word for word, in the user's order. Keep the same framework and style template.`;
      attempt++;
      continue;
    }

    // Safety net: never silently drop what the user wrote.
    restoreMissing(text, structured.cards);
    dropRepeatedTitles(text, structured.cards);
    // A card left with no text and no attached picture has nothing to show.
    structured.cards = structured.cards.filter((c) => c.text || c.subtitle || c.attachmentIndex != null);
    break;
  }
  return { structured, attempts: attempt + 1, cost };
}
