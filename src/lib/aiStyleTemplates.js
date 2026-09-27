// AI Carousel Builder — curated style templates for generated stories.
// Each template is a COMPLETE package: 2 fonts (display + accent), 3 colors
// (dominant, accent, secondary), a lighting mode (warm or calm), and a photo
// treatment (full-bleed or inset).
// The structuring call picks ONE package per story based on tone — never
// mixes fonts, colors, or treatments across packages.

const REFERENCE_CARD_SIZE = 320;

// Bookend/hook cards get a larger title; middle cards get a smaller one.
const COVER_TITLE_SIZE = '40';
const BOOKEND_TITLE_SIZE = '32';
const MIDDLE_TITLE_SIZE = '24';
const SUBTITLE_SIZE = '14';
const TEXT_WIDTH = 256; // 80% of 320px reference

// Inset image dimensions: 16:9 ratio, 80% card width
const INSET_IMG_WIDTH = TEXT_WIDTH; // 256px
const INSET_IMG_HEIGHT = Math.round(INSET_IMG_WIDTH * 9 / 16); // 144px

export const AI_STYLE_TEMPLATES = [
  {
    id: 'editorial-chartreuse',
    name: 'Editorial Chartreuse',
    grade: 'warm',
    lightingMode: 'warm',
    photoTreatment: 'full-bleed',
    displayFont: { family: 'Oswald', weight: '700' },
    accentFont: { family: 'IBM Plex Serif', weight: '400', italic: true },
    dominant: '#171208',
    accent: '#D7FF5C',
    secondary: '#C9C2A0',
  },
  {
    id: 'bold-lavender',
    name: 'Bold Lavender',
    grade: 'cool',
    lightingMode: 'warm',
    photoTreatment: 'inset',
    displayFont: { family: 'Archivo Black', weight: '400' },
    accentFont: { family: 'Fraunces', weight: '400', italic: true },
    dominant: '#14101A',
    accent: '#E8AEE3',
    secondary: '#B9A8C4',
  },
  {
    id: 'playful-coral',
    name: 'Playful Coral',
    grade: 'warm',
    lightingMode: 'warm',
    photoTreatment: 'full-bleed',
    displayFont: { family: 'Staatliches', weight: '400' },
    accentFont: { family: 'Space Grotesk', weight: '400' },
    dominant: '#170F0A',
    accent: '#FF6B3D',
    secondary: '#D9C7AE',
  },
  {
    id: 'clean-cream',
    name: 'Clean Cream',
    grade: 'neutral',
    lightingMode: 'calm',
    photoTreatment: 'inset',
    displayFont: { family: 'Barlow Condensed', weight: '700' },
    accentFont: { family: 'DM Sans', weight: '400' },
    dominant: '#10140F',
    accent: '#F1ECDD',
    secondary: '#A9B79E',
  },
];

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

// Get a style template by ID (falls back to clean-cream).
export function getStyleTemplate(id) {
  return AI_STYLE_TEMPLATES.find(t => t.id === id) || AI_STYLE_TEMPLATES[3];
}

// Get style templates by grade affinity.
export function getTemplatesByGrade(grade) {
  if (grade === 'neutral') return AI_STYLE_TEMPLATES;
  return AI_STYLE_TEMPLATES.filter(t => t.grade === grade || t.grade === 'neutral');
}

// Build card objects from structured AI data + a style template.
// Each structured card has: { text, subtitle, needsImage, imagePrompt, grade, isBookend, attachmentUrl }
// Returns card objects compatible with the existing card canvas.
//
// Photo treatment is per-story (part of the package), not per-card:
// - full-bleed: image fills the card edge-to-edge, text overlaid with a scrim.
// - inset: image sits inside the card at 16:9 with a margin, text stacked below.
// Flat cards (no image) use the same text layout regardless of treatment.
export function buildAICards(structuredCards, styleTemplate) {
  const tpl = typeof styleTemplate === 'string' ? getStyleTemplate(styleTemplate) : styleTemplate;
  const ts = Date.now();
  const isInset = tpl.photoTreatment === 'inset';

  // Create color tokens from the template's palette. All cards reference
  // these tokens instead of hardcoded colors — the same token system used
  // by manually built stories, so Card Theme editing works identically.
  const dominantToken = { id: `tk-${ts}-d`, name: 'Dominant', color: tpl.dominant };
  const accentToken = { id: `tk-${ts}-a`, name: 'Accent', color: tpl.accent };
  const secondaryToken = { id: `tk-${ts}-s`, name: 'Secondary', color: tpl.secondary };
  const tokens = [dominantToken, accentToken, secondaryToken];

  const cards = structuredCards.map((cardData, i) => {
    const cardId = `ai-${tpl.id}-${i}-${ts}-${Math.random().toString(36).slice(2)}`;
    const elements = [];
    const isCover = i === 0;
    const isBookend = cardData.isBookend || isCover || i === structuredCards.length - 1;
    const titleSize = isCover ? COVER_TITLE_SIZE : (isBookend ? BOOKEND_TITLE_SIZE : MIDDLE_TITLE_SIZE);
    const hasImage = !!cardData.imageUrl;

    let backgroundImageId = undefined;

    // ── Image element ──
    if (hasImage) {
      if (isInset) {
        // INSET: image sits inside the card at 16:9 with a margin.
        // No overlay/scrim — text lives below the image as stacked content.
        elements.push({
          id: `${cardId}-bg`,
          type: cardData.imageType === 'video' ? 'video' : 'image',
          image_url: cardData.imageUrl,
          crop_ratio: 'original',
          x: 10, // 32px margin (10% of 320)
          y: 5,  // 16px margin from top (5% of 320)
          displayWidth: INSET_IMG_WIDTH,
          displayHeight: INSET_IMG_HEIGHT,
          z_index: 0,
          ai_generated: !!cardData.aiGenerated,
        });
        backgroundImageId = `${cardId}-bg`;
      } else {
        // FULL-BLEED: image fills the card, text overlaid with a color scrim.
        elements.push({
          id: `${cardId}-bg`,
          type: cardData.imageType === 'video' ? 'video' : 'image',
          image_url: cardData.imageUrl,
          crop_ratio: 'original',
          x: 0,
          y: 0,
          displayWidth: REFERENCE_CARD_SIZE, displayHeight: REFERENCE_CARD_SIZE,
          clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
          z_index: 0,
          ai_generated: !!cardData.aiGenerated,
          overlay_type: 'Color',
          overlay_color: tpl.dominant,
          overlay_position: 'Bottom',
          overlay_intensity: 80,
        });
        backgroundImageId = `${cardId}-bg`;
      }
    }

    // ── Title text ──
    // Inset photo cards: accent font (serif weight on the headline)
    // Full-bleed photo cards: display font (sans-serif punch)
    // Flat cards: accent font (serif weight on reflective beats)
    if (cardData.text) {
      let titleY, titleFont, titleWeight, titleItalic;
      if (isCover) {
        // Cover card always uses the display font at bold weight for maximum prominence
        titleY = hasImage && isInset ? 53 : (cardData.subtitle ? 15 : 38);
        titleFont = tpl.displayFont.family;
        titleWeight = '700';
        titleItalic = false;
      } else if (hasImage && isInset) {
        titleY = 53; // below the 16:9 image (image bottom ~50% + gap)
        titleFont = tpl.accentFont.family;
        titleWeight = tpl.accentFont.weight || '400';
        titleItalic = !!tpl.accentFont.italic;
      } else if (hasImage) {
        titleY = cardData.subtitle ? 15 : 38;
        titleFont = tpl.displayFont.family;
        titleWeight = tpl.displayFont.weight;
        titleItalic = false;
      } else {
        titleY = cardData.subtitle ? 15 : 38;
        titleFont = tpl.accentFont.family;
        titleWeight = tpl.accentFont.weight || '400';
        titleItalic = !!tpl.accentFont.italic;
      }
      elements.push({
        id: `${cardId}-title`,
        type: 'text',
        content: cardData.text,
        x: 10,
        y: titleY,
        font_family: titleFont,
        font_size: titleSize,
        font_weight: titleWeight,
        font_italic: titleItalic,
        font_underline: false,
        font_strikethrough: false,
        text_align: 'left',
        color: tpl.accent,
        color_token: accentToken.id,
        text_type: 'header',
        z_index: 1000,
        displayWidth: TEXT_WIDTH,
        displayHeight: 0,
      });
    }

    // ── Subtitle/body text — display font at regular weight for readability ──
    // The accent font is reserved for titles only; body text uses the display
    // font at a non-bold weight suited for paragraph-length reading.
    if (cardData.subtitle) {
      const bodyY = cardData.text
        ? ((hasImage && isInset) ? 63 : 58)
        : ((hasImage && isInset) ? 53 : 20);
      elements.push({
        id: `${cardId}-subtitle`,
        type: 'text',
        content: cardData.subtitle,
        x: 10,
        y: bodyY,
        font_family: tpl.displayFont.family,
        font_size: SUBTITLE_SIZE,
        font_weight: '400',
        font_italic: false,
        font_underline: false,
        font_strikethrough: false,
        text_align: 'left',
        color: tpl.secondary,
        color_token: secondaryToken.id,
        text_type: 'body',
        z_index: 1001,
        displayWidth: TEXT_WIDTH,
        displayHeight: 0,
      });
    }

    return {
      id: cardId,
      background_color: tpl.dominant,
      background_token: dominantToken.id,
      elements,
      backgroundImageId,
      photoTreatment: tpl.photoTreatment,
      imageGenerationFailed: !!cardData.imageGenerationFailed,
      imagePrompt: cardData.imagePrompt || '',
    };
  });

  return { cards, tokens };
}

export { REFERENCE_CARD_SIZE };