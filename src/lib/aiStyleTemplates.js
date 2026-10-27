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

import { contrastRatio } from '@/lib/colorContrast';
import { getCardSize } from '@/lib/cardGeometry';
import {
  BODY_SIZES, CARD, CONTENT_WIDTH, LINE_HEIGHT, MARGIN, SCALE,
  loadStyleFonts, measureBox, splitSentences, wrapText,
} from '@/lib/cardLayout';

// Width of every card in reference px. The height depends on the story's
// card size (decision 45: 320 for 1:1, 400 for 4:5) and is passed around as
// `g` (cardGeometryFor below); x and widths are in % / px of the width, y in
// % of the height.
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
    // Brighter than the first version (Oz 2026-10-17: the dark green and
    // the brown/orange read as dead). Every pair clears AA contrast: text
    // 7.2:1, accent card 5.0:1.
    dominant: '#0F5C4A',
    ink: '#FFF3DC',
    accent: '#FFC53D',
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
    // Deep indigo and tangerine instead of charcoal and a dull orange
    // (Oz 2026-10-17). Text 14.2:1, accent card 5.5:1.
    dominant: '#1D1F4E',
    ink: '#F7F5EF',
    accent: '#FF6B3D',
  },
  // Font variations (Oz 2026-10-17: "more font variations"). The
  // structuring call still answers with one of the three styles above (its
  // mood); pickStyleVariant then picks one package of that mood per story,
  // so the server prompt didn't have to change. Each brings its own colours
  // (all pairs clear AA contrast) and only uses fonts the app already loads
  // (src/index.css).
  {
    id: 'field-notes-serif',
    mood: 'field-notes',
    name: 'Field notes serif',
    grade: 'warm',
    displayFont: { family: 'Playfair Display', weight: '700' },
    bodyFont: { family: 'Inter', weight: '400' },
    displayScale: 1.02,
    // Berry, blush cream, soft coral. Text 9.1:1, accent card 5.9:1.
    dominant: '#7A1F3D',
    ink: '#FFF1E6',
    accent: '#FFB4A2',
  },
  {
    id: 'poster-block',
    mood: 'poster',
    name: 'Poster block',
    grade: 'cool',
    displayFont: { family: 'Archivo Black', weight: '400' },
    bodyFont: { family: 'Inter', weight: '400' },
    // Archivo Black is very wide: a little smaller looks the same size.
    displayScale: 0.92,
    // Lemon, near-black, hot pink. Text 14.2:1, accent card 6.3:1.
    dominant: '#FFE14D',
    ink: '#141414',
    accent: '#FF5C93',
  },
  {
    id: 'poster-tall',
    mood: 'poster',
    name: 'Poster tall',
    grade: 'cool',
    // (Syne was tried first: its letters are taller than the layout
    // measures, so lines overlapped in the card lab.)
    displayFont: { family: 'Bebas Neue', weight: '400' },
    bodyFont: { family: 'IBM Plex Serif', weight: '400' },
    displayScale: 1.15,
    // Paper, deep plum, violet. Text 14.8:1, accent card 5.2:1.
    dominant: '#F7F0E6',
    ink: '#24163A',
    accent: '#6C3CF0',
  },
  {
    id: 'condensed-grotesk',
    mood: 'condensed',
    name: 'Grotesk',
    grade: 'neutral',
    displayFont: { family: 'Space Grotesk', weight: '700' },
    bodyFont: { family: 'Inter', weight: '400' },
    displayScale: 1,
    // Cobalt, ice white, mint. Text 9.4:1, accent card 6.0:1.
    dominant: '#0B3D91',
    ink: '#F4F7FF',
    accent: '#38E0B5',
  },
];

// The packages of each mood (see the variations above).
const STYLE_VARIANTS = AI_STYLE_TEMPLATES.reduce((acc, t) => {
  const mood = t.mood || t.id;
  (acc[mood] = acc[mood] || []).push(t.id);
  return acc;
}, {});

// Picks the package for a story from the style the structuring call chose.
// The same seed (the job id, or the notes) always gives the same package,
// so a story laid out twice (Drafts preview, then opening it) looks the
// same both times. An id that's already a package (re-running "edits only"
// on a story) is kept.
export function pickStyleVariant(styleId, seed) {
  const mood = LEGACY_TEMPLATE_IDS[styleId] || styleId;
  const list = STYLE_VARIANTS[mood];
  if (!list || !AI_STYLE_TEMPLATES.some((t) => t.id === mood && !t.mood)) return styleId;
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return list[h % list.length];
}

// Stories generated before the redesign name one of the old four templates
// (the structuring prompt now asks for field-notes, poster or condensed);
// they map onto the new styles by tone.
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
// The vertical room of a card: its height, the space between the top and
// bottom margins, and how tall a cover title may get (it must leave most of
// its picture visible).
function cardGeometryFor(cardSize) {
  const { id, height } = getCardSize(cardSize);
  const available = height - 2 * MARGIN;
  return { id, height, available, coverMaxText: Math.round(available * 0.6) };
}
// Per-card text size (Oz, 2026-10-16: "some cards with not much text the
// text just looks too small for the card"). The story's base size is set by
// the card with the most text, so cards with less text used to look empty.
// Each card now takes the largest of a few steps above the base size whose
// text still fits comfortably: at most TEXT_FILL of the space between the
// margins on a text card, or the room under a full-size picture. Titles grow
// with the body (never past the statement size), so a story still uses only
// a handful of sizes and the look stays consistent.
const SIZE_STEPS = [1.6, 1.4, 1.2];
// 0.85 (was 0.8, Oz 2026-10-17: slightly bigger text).
const TEXT_FILL = 0.85;

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

// A body set at a size above the story's body size (a short body-only card,
// see LEAD_MAX_HEIGHT) gets tighter leading than reading text.
function bodyLineHeight(size, bodySize) {
  return size > bodySize ? LINE_HEIGHT.lead : LINE_HEIGHT.body;
}

function blockHeights(tpl, header, body, headerSize, bodySize, gap, width = CONTENT_WIDTH, bodyAt = bodySize) {
  const h = header ? measureBox(header, tpl.displayFont, headerSize, headerLineHeight(headerSize, bodySize), width) : 0;
  const b = body ? measureBox(body, tpl.bodyFont, bodyAt, bodyLineHeight(bodyAt, bodySize), width) : 0;
  return { h, b, total: h + b + (h && b ? gap : 0) };
}

// Narrowest box width that keeps the same number of lines as the full
// content width: the lines come out about even (like CSS text-wrap:
// balance) instead of one long line and a short one. The box is then
// centred between the margins, so the empty space left and right is even
// too. Never below half the content width. Only for short blocks: a
// paragraph (more than BALANCE_MAX_BODY_LINES) keeps the full width, so
// reading text doesn't turn into a narrow column that changes width from
// card to card.
const BALANCE_MAX_BODY_LINES = 3;
function balancedWidth(tpl, header, body, headerSize, bodySize, gap, bodyAt = bodySize) {
  if (body && wrapText(body, tpl.bodyFont, bodyAt, CONTENT_WIDTH - 2).length > BALANCE_MAX_BODY_LINES) return CONTENT_WIDTH;
  const full = blockHeights(tpl, header, body, headerSize, bodySize, gap, CONTENT_WIDTH, bodyAt);
  const same = (w) => {
    const t = blockHeights(tpl, header, body, headerSize, bodySize, gap, w, bodyAt);
    return t.h === full.h && t.b === full.b;
  };
  let lo = Math.round(CONTENT_WIDTH / 2);
  let hi = CONTENT_WIDTH;
  if (same(lo)) return lo;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (same(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

// Top of a text-only block: centred vertically between the margins, so the
// space above and below is the same.
function centredTop(g, total) {
  return MARGIN + (g.available - total) / 2;
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
function storyFits(tpl, plans, body, g) {
  const s = sizesFor(tpl, body);
  return plans.every((p) => {
    if (p.kind === 'photo') return true; // photos adapt or split, see layoutPhoto
    if (p.kind === 'statement') return blockHeights(tpl, p.header, '', s.statement, s.body, s.gap).total <= g.available;
    if (p.kind === 'cover') {
      const max = p.src.imageUrl ? g.coverMaxText : g.available;
      return blockHeights(tpl, p.header, p.body, s.cover, s.body, s.gap).total <= max;
    }
    return blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap).total <= g.available;
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

function textElement(g, id, content, top, height, size, font, role, colorToken, color, z, lineHeight, width = CONTENT_WIDTH) {
  // Narrower boxes (balancedWidth) are centred between the margins.
  const left = MARGIN + (CONTENT_WIDTH - width) / 2;
  return {
    id,
    type: 'text',
    content,
    x: ((left - BOX_PADDING) / REFERENCE_CARD_SIZE) * 100,
    y: (top / g.height) * 100,
    displayWidth: width + 2 * BOX_PADDING,
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
// `width` is the text box width (default: the full content width); `bodyAt`
// the size the body is set at (default: the story's body size).
function stack(g, cardId, tpl, tokens, top, header, body, headerSize, bodySize, gap, width = CONTENT_WIDTH, bodyAt = bodySize) {
  const els = [];
  const { h, b } = blockHeights(tpl, header, body, headerSize, bodySize, gap, width, bodyAt);
  if (header) {
    els.push(textElement(g, `${cardId}-title`, header, top, h, headerSize, tpl.displayFont,
      'header', tokens.ink.id, tokens.ink.color, 1000, headerLineHeight(headerSize, bodySize), width));
  }
  if (body) {
    els.push(textElement(g, `${cardId}-subtitle`, body, top + (h ? h + gap : 0), b, bodyAt, tpl.bodyFont,
      'body', tokens.ink.id, tokens.ink.color, 1001, bodyLineHeight(bodyAt, bodySize), width));
  }
  return els;
}

// Largest size step at which `fits(sizes)` holds, with the title and the gap
// scaled with the body; the story's base sizes when no step fits.
function stepUp(tpl, s, fits) {
  const d = tpl.displayScale || 1;
  for (const f of SIZE_STEPS) {
    const body = Math.round(s.body * f);
    const sizes = {
      body,
      header: Math.min(s.statement, Math.round(body * SCALE.header * d)),
      gap: Math.round(body * 0.75),
    };
    if (fits(sizes)) return sizes;
  }
  return { body: s.body, header: s.header, gap: s.gap };
}

// Places a text-only block (no picture): balanced line widths, centred
// left-right and top-bottom.
function centredStack(g, cardId, tpl, tokens, header, body, headerSize, bodySize, gap, bodyAt = bodySize) {
  const width = balancedWidth(tpl, header, body, headerSize, bodySize, gap, bodyAt);
  const { total } = blockHeights(tpl, header, body, headerSize, bodySize, gap, width, bodyAt);
  return stack(g, cardId, tpl, tokens, centredTop(g, total), header, body, headerSize, bodySize, gap, width, bodyAt);
}

// ── Colour variation across cards ──
//
// Oz, 2026-10-16 (docs/generate-roadmap.md, A3): a story where every card has
// the same background looks flat. Each style's three colours now take turns:
//   - base:    Background colour behind Text colour (the style's usual look)
//   - inverse: the two swapped (Text colour behind Background colour)
//   - accent:  Accent colour behind whichever of the two reads better on it
// The cover and photo cards stay on base (the cover's scrim is in the base
// colour, and pictures sit best on it). Text cards alternate with the card
// before them, so two text cards in a row never look the same; short
// statements take the accent. A card that continues the text of the one
// before keeps its colours, so the two read as one.
// Only the three existing tokens are used, swapped per card, so editing
// the Card Theme still recolours the whole story.

const MIN_ACCENT_CONTRAST = 4.5; // WCAG AA for normal-size text

function cardSchemes(tokens) {
  const { dominant, ink, accent } = tokens;
  const onAccent = contrastRatio(accent.color, dominant.color) >= contrastRatio(accent.color, ink.color) ? dominant : ink;
  return {
    base: { bg: dominant, text: ink },
    inverse: { bg: ink, text: dominant },
    // A style whose accent can't carry readable text never uses accent cards.
    accent: contrastRatio(accent.color, onAccent.color) >= MIN_ACCENT_CONTRAST ? { bg: accent, text: onAccent } : null,
  };
}

// Builds card objects from structured AI data + a style template.
// Each structured card has: { text (header), subtitle (body), needsImage,
// imagePrompt, imageUrl?, imageType?, aiGenerated?, imageGenerationFailed? }.
// Returns { cards, tokens } compatible with the card canvas. Text is never
// edited here; a card whose body doesn't fit continues on a new card, split
// between sentences.
// `cardSize` is the story's card size ('1:1' default, '4:5'): the same
// rules on a taller card leave more room, so text is split less often.
export async function buildAICards(structuredCards, styleTemplate, { cardSize } = {}) {
  const tpl = typeof styleTemplate === 'string' ? getStyleTemplate(styleTemplate) : (styleTemplate || getStyleTemplate());
  const g = cardGeometryFor(cardSize);
  const AVAILABLE = g.available;
  await loadStyleFonts(tpl);
  const ts = Date.now();

  // Same token system as manually built stories, so Card Theme editing works.
  const tokens = {
    dominant: { id: `tk-${ts}-d`, name: 'Background', color: tpl.dominant },
    ink: { id: `tk-${ts}-i`, name: 'Text', color: tpl.ink },
    accent: { id: `tk-${ts}-a`, name: 'Accent', color: tpl.accent },
  };

  const plans = planCards(structuredCards);
  const bodySize = BODY_SIZES.find((size) => storyFits(tpl, plans, size, g)) ?? BODY_SIZES[BODY_SIZES.length - 1];
  const s = sizesFor(tpl, bodySize);

  // Sizes for a text-only card's block (see SIZE_STEPS).
  const textCardSizes = (header, body) => stepUp(tpl, s, (z) =>
    blockHeights(tpl, header, body, z.header, s.body, z.gap, CONTENT_WIDTH, z.body).total <= AVAILABLE * TEXT_FILL);

  const schemes = cardSchemes(tokens);
  // The colours of the card being built (see cardSchemes), and the tokens
  // its text uses: `ink` is whichever token is the text colour on this card.
  let scheme = schemes.base;
  let prevKind = null;
  const use = (kind) => {
    scheme = schemes[kind] || schemes.base;
    prevKind = kind;
    return { ...tokens, ink: scheme.text };
  };
  // Text cards alternate with the card before them; statements take the accent.
  const textKind = () => (prevKind === 'base' ? 'inverse' : 'base');
  const statementKind = () => (schemes.accent && prevKind !== 'accent' ? 'accent' : textKind());

  const cards = [];
  const newCard = (src, extra = {}) => {
    const id = `ai-${tpl.id}-${cards.length}-${ts}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      // Every card carries its own size (decision 45: a story can mix them).
      card_size: g.id,
      background_color: scheme.bg.color,
      background_token: scheme.bg.id,
      elements: [],
      backgroundImageId: undefined,
      photoTreatment: 'inset',
      imageGenerationFailed: !!src.imageGenerationFailed,
      imagePrompt: src.imagePrompt || '',
      ...extra,
    };
  };
  // Text that didn't fit continues on a plain text card right after.
  // It keeps the colours of the card it continues.
  const pushContinuation = (src, overflow, ct) => {
    let rest = overflow;
    while (rest) {
      const card = newCard({}, { imageGenerationFailed: false, imagePrompt: '' });
      const [kept, more] = splitToFit(tpl, '', rest, s.header, s.body, s.gap, AVAILABLE);
      const z = textCardSizes('', kept);
      card.elements = centredStack(g, card.id, tpl, ct, '', kept, z.header, s.body, z.gap, z.body);
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
      y: (box.y / g.height) * 100,
      displayWidth: box.w,
      displayHeight: box.h,
      z_index: 0,
      ai_generated: !!src.aiGenerated,
      ...extra,
    });

    if (p.kind === 'cover') {
      const ct = use('base');
      const card = newCard(src, { photoTreatment: hasImage ? 'full-bleed' : 'inset' });
      const { total } = blockHeights(tpl, p.header, p.body, s.cover, s.body, s.gap);
      if (hasImage) {
        // Full-bleed picture under a scrim in the card colour; title anchored bottom-left.
        const img = imageEl({ x: 0, y: 0, w: CARD, h: g.height }, {
          clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
          overlay_type: 'Color', overlay_color: tpl.dominant, overlay_position: 'Bottom', overlay_intensity: 80,
        });
        img.id = `${card.id}-bg`;
        card.elements.push(img);
        card.backgroundImageId = img.id;
      }
      const top = hasImage ? g.height - MARGIN - total : MARGIN + (AVAILABLE - total) * 0.55;
      card.elements.push(...stack(g, card.id, tpl, ct, top, p.header, p.body, s.cover, s.body, s.gap));
      cards.push(card);
      continue;
    }

    if (p.kind === 'photo') {
      const ct = use('base');
      const card = newCard(src);
      // On a taller card (4:5) the extra height goes to the picture, so the
      // text keeps the same room as on a square card and the card doesn't
      // end in an empty band. 1:1: exactly PHOTO_HEIGHT, as before.
      const PHOTO_MAX = PHOTO_HEIGHT + (g.height - CARD);
      // Shrink the picture (never below MIN_PHOTO_HEIGHT) before moving text away.
      const textRoomAt = (photoH) => g.height - MARGIN - (MARGIN + photoH + PHOTO_GAP);
      const photoHFor = (total) => Math.max(MIN_PHOTO_HEIGHT, Math.min(PHOTO_MAX, AVAILABLE - PHOTO_GAP - total));
      // Larger text when it all fits under the picture at full size.
      const z = stepUp(tpl, s, (zz) =>
        blockHeights(tpl, p.header, p.body, zz.header, s.body, zz.gap, CONTENT_WIDTH, zz.body).total <= textRoomAt(PHOTO_MAX));
      if (z.body > s.body) {
        const box = { x: MARGIN, y: MARGIN, w: CONTENT_WIDTH, h: PHOTO_MAX };
        card.imageBox = box;
        if (hasImage) {
          const img = imageEl(box);
          img.id = `${card.id}-bg`;
          card.elements.push(img);
          card.backgroundImageId = img.id;
        }
        card.elements.push(...stack(g, card.id, tpl, ct, MARGIN + PHOTO_MAX + PHOTO_GAP, p.header, p.body,
          z.header, s.body, z.gap, CONTENT_WIDTH, z.body));
        cards.push(card);
        continue;
      }
      const { total } = blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap);
      let photoH = photoHFor(total);
      let [body, overflow] = [p.body, ''];
      if (total > textRoomAt(photoH)) {
        [body, overflow] = splitToFit(tpl, p.header, p.body, s.header, s.body, s.gap, textRoomAt(photoH));
      }
      // splitToFit always keeps the first sentence. When even that one doesn't
      // fit under the picture (one long sentence), the whole body continues on
      // the next card and this card keeps the picture and the title, with the
      // picture back at full size. Without this the text ran off the bottom
      // of the card and the editor pushed it up over the title (Oz's 2026-10-16
      // production run, card 7).
      if (body && blockHeights(tpl, p.header, body, s.header, s.body, s.gap).total > textRoomAt(photoH)) {
        [body, overflow] = ['', p.body];
        photoH = photoHFor(blockHeights(tpl, p.header, '', s.header, s.body, s.gap).total);
      }
      // With no body under it, the picture (and title, if any) sits in the
      // middle of the card instead of leaving the bottom half empty.
      const headerOnly = p.header ? PHOTO_GAP + blockHeights(tpl, p.header, '', s.header, s.body, s.gap).total : 0;
      const photoTop = body ? MARGIN : MARGIN + (AVAILABLE - photoH - headerOnly) / 2;
      const box = { x: MARGIN, y: photoTop, w: CONTENT_WIDTH, h: photoH };
      // Where a retried picture goes when generation failed (StoryCreator).
      card.imageBox = box;
      if (hasImage) {
        const img = imageEl(box);
        img.id = `${card.id}-bg`;
        card.elements.push(img);
        card.backgroundImageId = img.id;
      }
      card.elements.push(...stack(g, card.id, tpl, ct, photoTop + photoH + PHOTO_GAP, p.header, body, s.header, s.body, s.gap));
      cards.push(card);
      pushContinuation(src, overflow, ct);
      continue;
    }

    if (p.kind === 'statement') {
      const ct = use(statementKind());
      const card = newCard(src);
      card.elements.push(...centredStack(g, card.id, tpl, ct, p.header, '', s.statement, s.body, s.gap));
      cards.push(card);
      continue;
    }

    // Text card.
    const ct = use(textKind());
    const card = newCard(src);
    let [body, overflow] = [p.body, ''];
    if (blockHeights(tpl, p.header, p.body, s.header, s.body, s.gap).total > AVAILABLE) {
      [body, overflow] = splitToFit(tpl, p.header, p.body, s.header, s.body, s.gap, AVAILABLE);
    }
    // Larger text when the card has room for it (see SIZE_STEPS).
    const z = textCardSizes(p.header, body);
    card.elements.push(...centredStack(g, card.id, tpl, ct, p.header, body, z.header, s.body, z.gap, z.body));
    cards.push(card);
    pushContinuation(src, overflow, ct);
  }

  return { cards, tokens: [tokens.dominant, tokens.ink, tokens.accent] };
}

export { REFERENCE_CARD_SIZE };
