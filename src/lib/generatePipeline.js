import { base44 } from '@/api/base44Client';
import { registerMedia } from '@/lib/mediaLibrary';
import { buildAICards } from '@/lib/aiStyleTemplates';

// Backstop: scan non-cover card prompts for face/person-descriptive language.
const FACE_KEYWORDS = /\b(face|faces|eye|eyes|smiling|smile|looking|looked|portrait|person|people|man|woman|boy|girl|character|expression|gaze|stare)\b/i;

// Fixed fallback prompt for non-cover cards when face-validation fails.
// Known-safe: hands/detail/object-only, no face language whatsoever.
const HANDS_DETAIL_FALLBACK_PROMPT = 'Top-down flat-lay of a laptop, mechanical keyboard, notepad with handwritten notes, pen resting across it, and a coffee mug. Even office light, muted color grade, visible film grain. No visible face, no person visible — objects and desk details only.';

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

// Full generation pipeline: structure → generate images → assemble cards.
// Reports progress via onProgress callback.
//
// editMode:
//   'full'       — run the entire pipeline (structure + image generation)
//   'edits_only' — re-structure only, keep existing images & style template
export async function runGeneratePipeline({ text, attachments, onProgress, editMode = 'full', existingCards = [], existingStyleTemplate }) {
  let userId = null;
  try {
    const user = await base44.auth.me();
    userId = user?.id;
  } catch {}

  // Step 1: Structure the story
  onProgress?.({ completedSteps: 0, totalSteps: 1, label: 'Structuring your story…' });

  const structRes = await base44.functions.invoke('structureStory', {
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

  // Add user-attached images to their cards
  attachments.forEach((att, i) => {
    const card = cards.find(c => c.attachmentIndex === i);
    if (card) {
      card.imageUrl = att.url;
      card.imageType = att.type || 'image';
      card.needsImage = true;
    }
  });

  // Step 2: Generate images for cards that need them (full mode only)
  if (editMode === 'full') {
    // Identify cards needing AI-generated images by index into the cards array.
    // We operate on cards[cardIndex] directly (not copies) so generated URLs
    // and failure flags propagate to buildAICards.
    const needingIndexes = [];
    cards.forEach((c, i) => {
      if (c.needsImage && !c.imageUrl) needingIndexes.push(i);
    });
    const totalSteps = 1 + needingIndexes.length;

    onProgress?.({
      completedSteps: 1,
      totalSteps,
      label: needingIndexes.length > 0 ? 'Generating images…' : 'Assembling carousel…',
    });

    for (let s = 0; s < needingIndexes.length; s++) {
      const cardIndex = needingIndexes[s];
      const card = cards[cardIndex];
      const isCover = cardIndex === 0;

      onProgress?.({
        completedSteps: s + 1,
        totalSteps,
        label: `Generating image ${s + 1} of ${needingIndexes.length}…`,
      });

      // ── (a) Was image generation attempted? ──
      if (!card.imagePrompt) {
        console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): NOT ATTEMPTED — needsImage=true but no imagePrompt from structuring`);
        card.imageGenerationFailed = true;
        continue;
      }

      console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): ATTEMPTED — imagePrompt drafted (${card.imagePrompt.length} chars)`);

      // ── (b) Face-validation: ALL cards (including cover) are sanitized + validated ──
      // No card is exempt — no prompt may describe a face or person. If the
      // backstop triggers, that signals a regression in prompt construction.
      let prompt = card.imagePrompt;
      const sanitized = sanitizePrompt(card.imagePrompt);
      const validation = validateSanitizedPrompt(sanitized);

      if (validation.valid) {
        prompt = sanitized;
        console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): face-validation PASSED — sanitized prompt ready`);
      } else {
        prompt = HANDS_DETAIL_FALLBACK_PROMPT;
        console.log(`[generate-pipeline] card ${cardIndex} (isCover=${isCover}): face-validation REJECTED — ${validation.reason}. Falling back to fixed object/detail template. THIS MAY INDICATE A REGRESSION IN PROMPT CONSTRUCTION.`);
      }

      // ── (c) Call generateImage ──
      try {
        console.log(`[generate-pipeline] card ${cardIndex}: CALLING generateImage (prompt: "${prompt.slice(0, 80)}…")`);
        const imgRes = await base44.functions.invoke('generateImage', { prompt });
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
    }

    onProgress?.({ completedSteps: totalSteps, totalSteps, label: 'Assembling carousel…' });
  } else {
    onProgress?.({ completedSteps: 1, totalSteps: 1, label: 'Assembling carousel…' });
  }

  // Step 3: Final safety net — ANY card that needed an image but has none after
  // the pipeline shows the failure state. This catches ALL failure paths:
  // no imagePrompt, face-validation rejection, generateImage failure/exception.
  // Regardless of which step caused the gap, the user sees the badge + retry.
  cards.forEach((card, i) => {
    if (card.needsImage && !card.imageUrl && !card.imageGenerationFailed) {
      console.log(`[generate-pipeline] card ${i}: marking imageGenerationFailed — needed image but has none after pipeline`);
      card.imageGenerationFailed = true;
    }
  });

  // Step 4: Assemble cards using the style template
  const styleTemplate = editMode === 'edits_only' && existingStyleTemplate
    ? existingStyleTemplate
    : structured.styleTemplate;

  const { cards: assembledCards, tokens } = buildAICards(cards, styleTemplate);

  return {
    cards: assembledCards,
    tokens,
    framework: structured.framework,
    styleTemplate,
  };
}