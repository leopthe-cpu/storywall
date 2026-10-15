// AI Carousel Builder — style templates and card assembly for generated stories.
//
// A style is a complete package: a display face for titles and headers, a
// readable body face, and three colours. The structuring call picks one per
// story; fonts and colours are never mixed across styles. The three styles
// (Field notes, Poster, Condensed) were chosen by Oz from the card lab sheet
// on 2026-10-15. Body text always uses a text face: the old templates used a
// condensed display face (Barlow Condensed) for paragraphs, which read badly.
//
// Layout comes from cardLayout.js: real text measurement, one type scale per
// story, and a small set of card layouts (cover, photo, statement, text).

import {
  BODY_SIZES, CARD, CONTENT_WIDTH, LINE_HEIGHT, MARGIN, SCALE,
  loadStyleFonts, measureBox, splitSentences,
} from '@/lib/cardLayout';

const REFERENCE_CARD_SIZE = CARD;
const BOX_PADDING = 2;

export const AI_STYLE_TEMPLATES = [
  {
    id: 'field-notes',
    name: 'Field notes',
    grade: 'warm',
    displayFont: { family: 'Fraunces', weight: '600' },
    bodyFont: { family: 'Source Sans 3', weight: '400' },
    // Visual size of the display face relative to the others at the same px.
    displayScale: 1,
    dominant: '#13231D',
    ink: '#EFEBE2',
    accent: '#E2A84B',
  },
  {
    id: 'poster',
    name: 'Poster',
    grade: 'cool',
    displayFont: { family: 'Anton', weight: '400', uppercase: true },
    bodyFont: { family: 'DM Sans', weight: '400' },
    displayScale: 1.08,
    dominant: '#E8EBEE',
    ink: '#15181C',
    accent: '#2C55E8',
  },
  {
    id: 'condensed',
    name: 'Condensed',
    grade: 'neutral',
    displayFont: { family: 'Barlow Condensed', weight: '700', uppercase: true },
    bodyFont: { family: 'Barlow', weight: '400' },
    displayScale: 1.12,
    dominant: '#1C1E22',
    ink: '#F2F2EF',
    accent: '#FF7A45',
  },
];

// The structuring prompt (structureStory/prompts.ts) still names the old
// four templates; until it is updated they map onto the new styles by tone.
const LEGACY_TEMPLATE_IDS = {
  'editorial-chartreuse': 'field-notes',
  'bold-lavender': 'poster',
  'playful-coral': 'poster',
  'clean-cream': 'condensed',
};

// Frameworks the structuring call can choose from (must match the prompt).
export const FRAMEWORKS = [
  'STAR',
  'RICE',
  'Career Timeline',
  'Before→After→Bridge',
  'Problem→Solution→Impact',
  'Turning Point',
  'Origin Story',
  'Failure→Lesson→Comeback',
  'By The Numbers',
  'Build→Measure→Learn',
  'Double Diamond',
  'Mentor Story',
  'Generic 4-beat',
];

// Get a style template by ID (old IDs map to their replacement; unknown IDs
// fall back to Condensed, the closest to the old default).
export function getStyleTemplate(id) {
  const resolved = LEGACY_TEMPLATE_IDS[id] || id;
  return AI_STYLE_TEMPLATES.find(t => t.id === resolved) || AI_STYLE_TEMPLATES[2];
}

// Get style templates by grade affinity.
export function getTemplatesByGrade(grade) {
  if (grade === 'neutral') return AI_STYLE_TEMPLATES;
  return AI_STYLE_TEMPLATES.filter(t => t.grade === grade || t.grade === 'neutral');
}

// ── Layout ──

// Inset photo: full content width at 16:9, top-aligned. It may get shorter
// (down to MIN_PHOTO_HEIGHT) to make room for the text under it.
const PHOTO_HEIGHT = Math.round(CONTENT_WIDTH * 9 / 16); // 153
const MIN_PHOTO_HEIGHT = 112;
const PHOTO_GAP = 16;
// Statements are short lines set large; longer text is a normal text card.
const STATEMENT_MAX_CHARS = 70;
// A cover title must leave most of its picture visible.
const COVER_MAX_TEXT_HEIGHT = Math.round((CARD - 2 * MARGIN) * 0.6);
const AVAILABLE = CARD - 2 * MARGIN;

function sizesFor(tpl, body) {
  const d = tpl.displayScale || 1;
  return {
    body,
    header: Math.round(body * SCALE.header * d),
    statement: Math.round(body * SCALE.statement * d),
    cover: Math.round(body * SCALE.cover * d),
    gap: Math.round(body * 0.75),
  };
}

// Heights of a header + body block at the given sizes.
// Display sizes (statement, cover) get the tightest leading, headers a
// little more, body text the most.
function headerLineHeight(size, bodySize) {
  return size >= bodySize * SCALE.statement ? LINE_HEIGHT.display : LINE_HEIGHT.header;
}

function blockHeights(tpl, header, body, headerSize, bodySize, gap) {
  const h = header ? measureBox(header, tpl.displayFont, headerSize, headerLineHeight(headerSize, bodySize)) : 0;
  const b = body ? measureBox(body, tpl.bodyFont, bodySize, LINE_HEIGHT.body) : 0;
  return { h, b, total: h + b + (h && b ? gap : 0) };
}

// What kind of card each structured card becomes.
function planCards(structuredCards) {
  return structuredCards.map((c, i) => {
    const header = (c.text || '').trim();
    const body = (c.subtitle || '').trim();
    // A card that asked for a picture keeps the photo layout even if the
    // picture failed, so a retried picture lands in its reserved space.
    const wantsPhoto = !!c.imageUrl || (!!c.needsImage && !!c.imageGenerationFailed);
    let kind;
    if (i === 0) kind = 'cover';
    else if (wantsPhoto) kind = 'photo';
    else if (header && !body && header.length <= STATEMENT_MAX_CHARS) kind = 'statement';
    else kind = 'text';
    return { src: c, kind, header, body };
  });
}

// Does every text-only card fit at this body size, without splitting?
function storyFits(tpl, plans, body) {
  const s = sizesFor(tpl, body);
  return plans.every((p) => {
    if (p.kind === 'photo') return true; // photos adapt or split, see layoutPhoto
    if (p.kind === 'statement') return blockHeights(tpl, p.header, '', s.statement, s.body, s.gap).total <= AVAILABLE;
    if (p.kind === 'cover') {
      const max = p.src.imageUrl ? COVER_MAX_TEXT_HEIGHT : AVAILABLE;
      return blockHeights(tpl, p.header, p.body, s.cover, s.body, s.gap).total <= max;
    }
    return blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap).total <= AVAILABLE;
  });
}

// Moves whole sentences off the end of `body` until the rest fits `maxHeight`
// together with the header. Returns [kept, overflow]; text is never changed,
// only divided between this card and a continuation card.
function splitToFit(tpl, header, body, headerSize, bodySize, gap, maxHeight) {
  const sentences = splitSentences(body);
  let keep = sentences.length;
  while (keep > 1) {
    const kept = sentences.slice(0, keep).join('').trim();
    if (blockHeights(tpl, header, kept, headerSize, bodySize, gap).total <= maxHeight) break;
    keep -= 1;
  }
  return [sentences.slice(0, keep).join('').trim(), sentences.slice(keep).join('').trim()];
}

function textElement(id, content, top, height, size, font, role, colorToken, color, z, lineHeight) {
  return {
    id,
    type: 'text',
    content,
    x: ((MARGIN - BOX_PADDING) / REFERENCE_CARD_SIZE) * 100,
    y: (top / REFERENCE_CARD_SIZE) * 100,
    displayWidth: CONTENT_WIDTH + 2 * BOX_PADDING,
    displayHeight: Math.ceil(height),
    font_family: font.family,
    font_size: String(size),
    font_weight: font.weight || '400',
    font_italic: !!font.italic,
    font_underline: false,
    font_strikethrough: false,
    text_transform: font.uppercase ? 'uppercase' : 'none',
    text_align: 'left',
    color,
    color_token: colorToken,
    text_type: role,
    line_height: lineHeight,
    z_index: z,
    // Sized by the layout engine: the editor's one-time estimate must not
    // run again and overwrite it (see DraggableElement).
    font_size_estimated: true,
  };
}

// Stacks header and body from `top`, returns the text elements.
function stack(cardId, tpl, tokens, top, header, body, headerSize, bodySize, gap) {
  const els = [];
  const { h, b } = blockHeights(tpl, header, body, headerSize, bodySize, gap);
  if (header) {
    els.push(textElement(`${cardId}-title`, header, top, h, headerSize, tpl.displayFont,
      'header', tokens.ink.id, tpl.ink, 1000, headerLineHeight(headerSize, bodySize)));
  }
  if (body) {
    els.push(textElement(`${cardId}-subtitle`, body, top + (h ? h + gap : 0), b, bodySize, tpl.bodyFont,
      'body', tokens.ink.id, tpl.ink, 1001, LINE_HEIGHT.body));
  }
  return els;
}

// Builds card objects from structured AI data + a style template.
// Each structured card has: { text (header), subtitle (body), needsImage,
// imagePrompt, imageUrl?, imageType?, aiGenerated?, imageGenerationFailed? }.
// Returns { cards, tokens } compatible with the card canvas. Text is never
// edited here; a card whose body doesn't fit continues on a new card, split
// between sentences.
export async function buildAICards(structuredCards, styleTemplate) {
  const tpl = typeof styleTemplate === 'string' ? getStyleTemplate(styleTemplate) : (styleTemplate || getStyleTemplate());
  await loadStyleFonts(tpl);
  const ts = Date.now();

  // Same token system as manually built stories, so Card Theme editing works.
  const tokens = {
    dominant: { id: `tk-${ts}-d`, name: 'Background', color: tpl.dominant },
    ink: { id: `tk-${ts}-i`, name: 'Text', color: tpl.ink },
    accent: { id: `tk-${ts}-a`, name: 'Accent', color: tpl.accent },
  };

  const plans = planCards(structuredCards);
  const bodySize = BODY_SIZES.find((size) => storyFits(tpl, plans, size)) ?? BODY_SIZES[BODY_SIZES.length - 1];
  const s = sizesFor(tpl, bodySize);

  const cards = [];
  const newCard = (src, extra = {}) => {
    const id = `ai-${tpl.id}-${cards.length}-${ts}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      background_color: tpl.dominant,
      background_token: tokens.dominant.id,
      elements: [],
      backgroundImageId: undefined,
      photoTreatment: 'inset',
      imageGenerationFailed: !!src.imageGenerationFailed,
      imagePrompt: src.imagePrompt || '',
      ...extra,
    };
  };
  // Text that didn't fit continues on a plain text card right after.
  const pushContinuation = (src, overflow) => {
    let rest = overflow;
    while (rest) {
      const card = newCard({}, { imageGenerationFailed: false, imagePrompt: '' });
      const [kept, more] = splitToFit(tpl, '', rest, s.header, s.body, s.gap, AVAILABLE);
      const { total } = blockHeights(tpl, '', kept, s.header, s.body, s.gap);
      card.elements = stack(card.id, tpl, tokens, MARGIN + (AVAILABLE - total) * 0.42, '', kept, s.header, s.body, s.gap);
      cards.push(card);
      rest = more;
    }
  };

  for (const p of plans) {
    const src = p.src;
    const hasImage = !!src.imageUrl;
    const imageEl = (box, extra = {}) => ({
      id: '',
      type: src.imageType === 'video' ? 'video' : 'image',
      image_url: src.imageUrl,
      crop_ratio: 'original',
      x: (box.x / REFERENCE_CARD_SIZE) * 100,
      y: (box.y / REFERENCE_CARD_SIZE) * 100,
      displayWidth: box.w,
      displayHeight: box.h,
      z_index: 0,
      ai_generated: !!src.aiGenerated,
      ...extra,
    });

    if (p.kind === 'cover') {
      const card = newCard(src, { photoTreatment: hasImage ? 'full-bleed' : 'inset' });
      const { total } = blockHeights(tpl, p.header, p.body, s.cover, s.body, s.gap);
      if (hasImage) {
        // Full-bleed picture under a scrim in the card colour; title anchored bottom-left.
        const img = imageEl({ x: 0, y: 0, w: CARD, h: CARD }, {
          clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
          overlay_type: 'Color', overlay_color: tpl.dominant, overlay_position: 'Bottom', overlay_intensity: 80,
        });
        img.id = `${card.id}-bg`;
        card.elements.push(img);
        card.backgroundImageId = img.id;
      }
      const top = hasImage ? CARD - MARGIN - total : MARGIN + (AVAILABLE - total) * 0.55;
      card.elements.push(...stack(card.id, tpl, tokens, top, p.header, p.body, s.cover, s.body, s.gap));
      cards.push(card);
      continue;
    }

    if (p.kind === 'photo') {
      const card = newCard(src);
      // Shrink the picture (never below MIN_PHOTO_HEIGHT) before moving text away.
      const textRoomAt = (photoH) => CARD - MARGIN - (MARGIN + photoH + PHOTO_GAP);
      const { total } = blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap);
      const photoH = Math.max(MIN_PHOTO_HEIGHT, Math.min(PHOTO_HEIGHT, CARD - 2 * MARGIN - PHOTO_GAP - total));
      let [body, overflow] = [p.body, ''];
      if (total > textRoomAt(photoH)) {
        [body, overflow] = splitToFit(tpl, p.header, p.body, s.header, s.body, s.gap, textRoomAt(photoH));
      }
      const box = { x: MARGIN, y: MARGIN, w: CONTENT_WIDTH, h: photoH };
      // Where a retried picture goes when generation failed (StoryCreator).
      card.imageBox = box;
      if (hasImage) {
        const img = imageEl(box);
        img.id = `${card.id}-bg`;
        card.elements.push(img);
        card.backgroundImageId = img.id;
      }
      card.elements.push(...stack(card.id, tpl, tokens, MARGIN + photoH + PHOTO_GAP, p.header, body, s.header, s.body, s.gap));
      cards.push(card);
      pushContinuation(src, overflow);
      continue;
    }

    if (p.kind === 'statement') {
      const card = newCard(src);
      const { total } = blockHeights(tpl, p.header, '', s.statement, s.body, s.gap);
      // Optically centred: a little above the middle.
      card.elements.push(...stack(card.id, tpl, tokens, MARGIN + (AVAILABLE - total) * 0.42, p.header, '', s.statement, s.body, s.gap));
      cards.push(card);
      continue;
    }

    // Text card.
    const card = newCard(src);
    let [body, overflow] = [p.body, ''];
    if (blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap).total > AVAILABLE) {
      [body, overflow] = splitToFit(tpl, p.header, p.body, s.header, s.body, s.gap, AVAILABLE);
    }
    const { total } = blockHeights(tpl, p.header, body, s.header, s.body, s.gap);
    card.elements.push(...stack(card.id, tpl, tokens, MARGIN + (AVAILABLE - total) * 0.42, p.header, body, s.header, s.body, s.gap));
    cards.push(card);
    pushContinuation(src, overflow);
  }

  return { cards, tokens: [tokens.dominant, tokens.ink, tokens.accent] };
}

export { REFERENCE_CARD_SIZE };
