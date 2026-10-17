import { getMe, invokeFunction } from '@/api/storywallApi';
import { registerMedia } from '@/lib/mediaLibrary';
import { buildAICards, getStyleTemplate, pickStyleVariant } from '@/lib/aiStyleTemplates';
import { withTheme } from '@/lib/colorPalettes';

// Backstop: scan non-cover card prompts for face/person-descriptive language.
const FACE_KEYWORDS = /\b(face|faces|eye|eyes|smiling|smile|looking|looked|portrait|person|people|man|woman|boy|girl|character|expression|gaze|stare)\b/i;

// Most AI pictures in one story (Oz, 2026-10-15): pictures complement the
// story; they don't need to be on every card.
const MAX_GENERATED_IMAGES = 3;

function sanitizePrompt(prompt) {
  if (!prompt || !FACE_KEYWORDS.test(prompt)) return prompt;
  const sentences = prompt.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
  const kept = sentences.filter(s => !FACE_KEYWORDS.test(s));
  const base = kept.join('. ');
  return `${base}. No visible face, no person visible — hands, objects, and details only, from-behind framing.`.trim();
}

// Validate a sanitized prompt: returns { valid, reason }
function validateSanitizedPrompt(sanitized) {
  if (!sanitized || sanitized.trim().length < 10) {
    return { valid: false, reason: 'empty or too short after stripping face sentences' };
  }
  if (FACE_KEYWORDS.test(sanitized)) {
    return { valid: false, reason: 'still contains face/person language after sanitization' };
  }
  return { valid: true, reason: 'passed' };
}

// Puts the user's attached pictures on the cards the AI chose for them.
// Shared with the server-job version (src/lib/generateJob.js).
export function placeAttachments(cards, attachments) {
  (attachments || []).forEach((att, i) => {
    const card = cards.find(c => c.attachmentIndex === i);
    if (card) {
      card.imageUrl = att.url;
      card.imageType = att.type || 'image';
      card.needsImage = true;
    }
  });
}

// A card that needed a picture but has none shows the failure badge and the
// retry button, whatever the reason (no prompt, refused prompt, failed call).
export function markMissingPictures(cards) {
  cards.forEach((card, i) => {
    if (card.needsImage && !card.imageUrl && !card.imageGenerationFailed) {
      console.log(`[generate-pipeline] card ${i}: marking imageGenerationFailed — needed image but has none after pipeline`);
      card.imageGenerationFailed = true;
    }
  });
}

// Full generation pipeline: structure → generate images → assemble cards.
// Reports progress via onProgress callback.
//
// editMode:
//   'full'       — run the entire pipeline (structure + image generation)
//   'edits_only' — re-structure only, keep existing images & style template
export async function runGeneratePipeline({ text, attachments, onProgress, editMode = 'full', existingCards = [], existingStyleTemplate, theme = null }) {
  let userId = null;
  try {
    const user = await getMe();
    userId = user?.id;
  } catch {}

  // Step 1: Structure the story
  onProgress?.({ completedSteps: 0, totalSteps: 1, label: 'Structuring your story…' });

  const structRes = await invokeFunction('structureStory', {
    text,
    attachments: attachments.map(a => ({ url: a.url, type: a.type })),
  });

  const structured = structRes?.data?.structured;
  if (!structured || !Array.isArray(structured.cards)) {
    throw new Error('Failed to structure story');
  }

  // cards are the canonical mutable objects — buildAICards reads from these.
  // Properties set on cards[i] here propagate through to the assembled output.
  let cards = structured.cards.map(c => ({ ...c }));

  // For edits_only mode, keep existing images by position
  if (editMode === 'edits_only' && existingCards.length > 0) {
    existingCards.forEach((oldCard, i) => {
      if (i >= cards.length) return;
      const bgEl = (oldCard.elements || []).find(e => e.id === oldCard.backgroundImageId);
      if (bgEl && bgEl.image_url) {
        cards[i].imageUrl = bgEl.image_url;
        cards[i].aiGenerated = !!bgEl.ai_generated;
        cards[i].imageType = bgEl.type === 'video' ? 'video' : 'image';
        cards[i].needsImage = true;
      }
    });
  }

  placeAttachments(cards, attachments);

  // Step 2: Generate images for cards that need them (full mode only)
  if (editMode === 'full') {
    // Identify cards needing AI-generated images by index into the cards array.
    // We operate on cards[cardIndex] directly (not copies) so generated URLs
    // and failure flags propagate to buildAICards.
    let needingIndexes = [];
    cards.forEach((c, i) => {
      if (c.needsImage && !c.imageUrl) needingIndexes.push(i);
    });
    // At most MAX_GENERATED_IMAGES per story (the structuring prompt asks for
    // the same; this enforces it). The first ones win, so the cover keeps its
    // picture; the others become text cards.
    needingIndexes.slice(MAX_GENERATED_IMAGES).forEach((i) => { cards[i].needsImage = false; });
    needingIndexes = needingIndexes.slice(0, MAX_GENERATED_IMAGES);
    const totalSteps = 1 + needingIndexes.length;
    let done = 0;

    onProgress?.({
      completedSteps: 1,
      totalSteps,
      label: needingIndexes.length > 0 ? `Generating ${needingIndexes.length === 1 ? 'image' : `${needingIndexes.length} images`}…` : 'Assembling carousel…',
    });

    // Pictures are generated at the same time: each takes up to a minute, so
    // one after another made a story with 5 pictures take over 5 minutes.
    await Promise.all(needingIndexes.map(async (cardIndex) => {
      const card = cards[cardIndex];
      const isCover = cardIndex === 0;

      // ── (a) Was image generation attempted? ──
      if (!card.imagePrompt) {
        console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): NOT ATTEMPTED — needsImage=true but no imagePrompt from structuring`);
        card.imageGenerationFailed = true;
        return;
      }

      // ── (b) Face-validation: ALL cards (including cover) are sanitized + validated ──
      // No card is exempt — no prompt may describe a face or person. A prompt
      // that can't be cleaned gets no picture: the old fixed fallback (a desk
      // flat-lay) put the same unrelated scene on every story.
      const sanitized = sanitizePrompt(card.imagePrompt);
      const validation = validateSanitizedPrompt(sanitized);
      if (!validation.valid) {
        console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): face-validation REJECTED — ${validation.reason}. No picture for this card. THIS MAY INDICATE A REGRESSION IN PROMPT CONSTRUCTION.`);
        card.needsImage = false;
        return;
      }
      const prompt = sanitized;

      // ── (c) Call generateImage ──
      try {
        console.log(`[generate-pipeline] card ${cardIndex}: CALLING generateImage (prompt: "${prompt.slice(0, 80)}…")`);
        const imgRes = await invokeFunction('generateImage', { prompt });
        const imageUrl = imgRes?.data?.url;
        if (imageUrl) {
          card.imageUrl = imageUrl;
          card.aiGenerated = true;
          console.log(`[generate-pipeline] card ${cardIndex}: SUCCEEDED — image URL received`);
          // Save to media gallery so it appears in the user's library
          if (userId) {
            try {
              await registerMedia({ image_url: imageUrl, media_type: 'image' });
            } catch (e) {
              console.log(`[generate-pipeline] card ${cardIndex}: media gallery save failed: ${e?.message || e}`);
            }
          }
        } else {
          console.error(`[generate-pipeline] card ${cardIndex}: FAILED — generateImage returned no URL. Response: ${JSON.stringify(imgRes?.data)?.slice(0, 200)}`);
          card.imageGenerationFailed = true;
        }
      } catch (e) {
        console.error(`[generate-pipeline] card ${cardIndex}: FAILED — generateImage threw: ${e?.message || e}`);
        card.imageGenerationFailed = true;
      }
      done += 1;
      onProgress?.({
        completedSteps: 1 + done,
        totalSteps,
        label: done < needingIndexes.length ? `Generating images… ${done} of ${needingIndexes.length} done` : 'Assembling carousel…',
      });
    }));

    onProgress?.({ completedSteps: totalSteps, totalSteps, label: 'Assembling carousel…' });
  } else {
    onProgress?.({ completedSteps: 1, totalSteps: 1, label: 'Assembling carousel…' });
  }

  // Step 3: Final safety net — ANY card that needed an image but has none after
  // the pipeline shows the failure state. This catches ALL failure paths:
  // no imagePrompt, face-validation rejection, generateImage failure/exception.
  // Regardless of which step caused the gap, the user sees the badge + retry.
  markMissingPictures(cards);

  // Step 4: Assemble cards using the style template
  const styleTemplate = editMode === 'edits_only' && existingStyleTemplate
    ? existingStyleTemplate
    : pickStyleVariant(structured.styleTemplate, text);

  // The colour theme picked on the notes screen, if any (ThemePicker).
  const { cards: assembledCards, tokens } = await buildAICards(cards, withTheme(getStyleTemplate(styleTemplate), theme));

  return {
    cards: assembledCards,
    tokens,
    framework: structured.framework,
    styleTemplate,
  };
}