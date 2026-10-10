import type { chatJson, ContentPart } from '../_shared/openrouter.ts';
import { SYSTEM_PROMPT, VERIFY_PROMPT } from './prompts.ts';

// The structuring steps of base44/functions/structureStory, unchanged:
//   1. structure the story into cards,
//   2. a second AI call checks that no sentence/clause was dropped and that
//      titles are grounded in their own card,
//   3. one retry with the missing sentences as feedback, then title fixes
//      are applied and anything still missing is appended to the last card
//      so nothing the user wrote is ever silently lost.
// The AI call is passed in, so the steps can be tested without the network.

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

export const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    missingSentences: { type: 'array', items: { type: 'string' } },
    titleCorrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { cardIndex: { type: 'number' }, newTitle: { type: 'string' } },
        required: ['cardIndex', 'newTitle'],
        additionalProperties: false,
      },
    },
  },
  required: ['missingSentences', 'titleCorrections'],
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

    const verifyPrompt = VERIFY_PROMPT +
      "\n\n--- USER'S ORIGINAL TEXT ---\n" + text +
      '\n\n--- STRUCTURED CARDS ---\n' + JSON.stringify(
        structured.cards.map((c, i) => ({ cardIndex: i, title: c.text, body: c.subtitle || null })),
        null,
        2,
      );
    const check = await chat({ model, name: 'verification', schema: VERIFY_SCHEMA, user: verifyPrompt });
    addCost(check.cost);
    // deno-lint-ignore no-explicit-any
    const verification = (check.data || {}) as any;
    const missing: string[] = Array.isArray(verification.missingSentences)
      ? verification.missingSentences.filter((s: unknown) => typeof s === 'string' && s)
      : [];
    const corrections: Array<{ cardIndex: number; newTitle: string }> =
      Array.isArray(verification.titleCorrections) ? verification.titleCorrections : [];

    if (missing.length > 0 && attempt < MAX_ATTEMPTS - 1) {
      feedback = `Your previous attempt dropped these sentences from the user's text — they must all appear somewhere in the cards:\n` +
        missing.map((s, i) => `${i + 1}. "${s}"`).join('\n') +
        `\n\nRestructure the story ensuring every sentence from the user's original text is included in at least one card. Keep the same framework and style template.`;
      attempt++;
      continue;
    }

    for (const c of corrections) {
      if (Number.isInteger(c?.cardIndex) && c.cardIndex >= 0 && c.cardIndex < structured.cards.length && c.newTitle) {
        structured.cards[c.cardIndex].text = c.newTitle;
      }
    }
    // Safety net: never silently drop what the user wrote.
    if (missing.length > 0) {
      const last = structured.cards[structured.cards.length - 1];
      for (const s of missing) last.subtitle = (last.subtitle ? last.subtitle + ' ' : '') + s;
    }
    break;
  }
  return { structured, attempts: attempt + 1, cost };
}
