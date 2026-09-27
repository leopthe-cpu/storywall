// Story templates — 6 launch templates, black & white, no images.
// Each template defines a font pairing (display + accent) and card-by-card copy.
// Title = headline (display font, 700+ weight). Subtitle = smaller line (accent font, ≤500 weight).
// Suggested starting sizes: title ~20% of card width (64px in 320px ref), subtitle ~7% (22px).

const REFERENCE_CARD_SIZE = 320;
const TITLE_SIZE = '40';   // Cover — exempt from reduction
const SUBTITLE_SIZE = '16'; // ~5% of 320px (was 22, reduced ~27%)
const TEXT_WIDTH = 256;     // 80% of 320px

export const STORY_TEMPLATES = [
  {
    id: 'feature-nobody-asked',
    name: 'The Feature Nobody Asked For',
    framework: 'STAR',
    category: 'Product',
    displayFont: { family: 'Archivo', weight: '900' },
    accentFont: { family: 'DM Sans', weight: '400' },
    cards: [
      {
        title: "Users weren't leaving because of bugs.",
        subtitle: "They were leaving quietly, after their first week — and we didn't know why.",
      },
      {
        title: "Three weeks. No budget.",
        subtitle: "That's what I had to find out why, and fix it.",
      },
      {
        title: "Nobody explained what the product did until day 4.",
        subtitle: "So I killed the onboarding tour and rebuilt it around one thing: get to value in under 60 seconds.",
      },
      {
        title: "Week-one retention: 41% → 68%.",
        subtitle: "The fix cost nothing. It just required admitting the problem wasn't the product.",
      },
    ],
  },
  {
    id: 'number-nobody-believed',
    name: 'The Number Nobody Believed',
    framework: 'By The Numbers',
    category: 'Marketing',
    displayFont: { family: 'Bebas Neue', weight: '400' },
    accentFont: { family: 'Space Grotesk', weight: '400' },
    cards: [
      {
        title: "3.2x",
        subtitle: "That's how much pipeline came out of a campaign with a $0 media budget.",
      },
      {
        title: "We couldn't afford ads that quarter.",
        subtitle: "We weren't trying to prove a point. We just had no other option.",
      },
      {
        title: "So we asked 40 customers one question.",
        subtitle: "What almost stopped you from buying? Then we put their exact words in the campaign.",
      },
      {
        title: "No paid spend. 3.2x the pipeline.",
        subtitle: "Of the campaign before it — at a fraction of the cost.",
      },
    ],
  },
  {
    id: '3am-page',
    name: 'The 3AM Page That Changed How We Shipped',
    framework: 'Problem → Solution → Impact',
    category: 'Engineering',
    displayFont: { family: 'Barlow Condensed', weight: '700' },
    accentFont: { family: 'IBM Plex Serif', weight: '400' },
    cards: [
      {
        title: "The alert went off at 3:12 AM. Again.",
        subtitle: "Same service. Third time that month.",
      },
      {
        title: "A slow memory leak nobody could reproduce locally.",
        subtitle: "Every fix so far had just been a patch on top of a guess.",
      },
      {
        title: "So I instrumented the service instead of guessing.",
        subtitle: "Traced it to a caching layer holding references it should have dropped.",
      },
      {
        title: "Zero pages from that service since.",
        subtitle: "The instrumentation we built is now the template every team uses before shipping anything stateful.",
      },
    ],
  },
  {
    id: 'redesign-nobody-liked',
    name: 'The Redesign Nobody Liked (At First)',
    framework: 'Failure → Lesson → Comeback',
    category: 'Design',
    displayFont: { family: 'Oswald', weight: '700' },
    accentFont: { family: 'Playfair Display', weight: '400' },
    cards: [
      {
        title: "We shipped the redesign. Support tickets tripled by lunch.",
      },
      {
        title: "We'd tested it with 5 people who loved change.",
        subtitle: "Not with the other 95% who just wanted their muscle memory back.",
      },
      {
        title: "Good design isn't what's cleaner. It's what people can use without thinking.",
        subtitle: "We'd optimized for a demo, not a habit.",
      },
      {
        title: "Tickets dropped below pre-redesign levels within a month.",
        subtitle: "We kept 80% of the new visual system — and rebuilt the navigation around old habits.",
      },
    ],
  },
  {
    id: 'deal-almost-didnt-take',
    name: 'The Deal I Almost Didn\'t Take',
    framework: 'Turning Point',
    category: 'Sales',
    displayFont: { family: 'Staatliches', weight: '400' },
    accentFont: { family: 'Fraunces', weight: '400', italic: true },
    cards: [
      {
        title: "The prospect had already said no. Twice.",
      },
      {
        title: "Everyone told me to move on.",
        subtitle: "The pipeline had bigger, easier names in it.",
      },
      {
        title: "I asked their team one question nobody had asked.",
        subtitle: "What actually happens the day this breaks for you? That answer wasn't in my deck.",
      },
      {
        title: "They became our first enterprise logo.",
        subtitle: "And the story we used to close the next four.",
      },
    ],
  },
  {
    id: 'how-i-ended-up-here',
    name: 'How I Ended Up Doing This For a Living',
    framework: 'Origin Story',
    category: 'General',
    displayFont: { family: 'Danfo', weight: '700' },
    accentFont: { family: 'DM Sans', weight: '400' },
    cards: [
      {
        title: "I didn't plan on this.",
        subtitle: "Nobody really does.",
      },
      {
        title: "It started as the thing nobody else wanted to own.",
        subtitle: "The messy, unglamorous problem in between two departments.",
      },
      {
        title: "I kept picking up the same kind of problem on purpose.",
        subtitle: "It was the one part of the job that never felt like work.",
      },
      {
        title: "Years later, it's the job title on my card.",
        subtitle: "Still the part I look forward to most.",
      },
    ],
  },
  {
    id: 'bold-poster',
    name: 'Bold Poster',
    framework: 'Generic 4-beat',
    category: 'Design',
    displayFont: { family: 'Anton', weight: '400' },
    accentFont: { family: 'Inter', weight: '400' },
    colors: {
      background: '#2F39A9',
      title: '#f9faff',
      body: '#00f2e2',
    },
    cards: [
      {
        title: "THE LAST TAP",
        background: '#2F39A9',
        titleColor: '#f9faff',
        titleSize: '85',
        allCaps: true,
        titleX: 10.2, titleY: 7.6, titleWidth: 237,
      },
      {
        subtitle: "Our booking flow had five screens between opening the app and confirming a ride. Internal data showed 40% of users who started a booking never finished it, and most of them disappeared on screen three, the fare estimate.",
        background: '#ffffff',
        bodyColor: '#2F39A9',
        bodySize: '19',
        bodyX: 5.6, bodyY: 7.1, bodyWidth: 286,
      },
      {
        title: "Screen Three.",
        subtitle: "We sat with twelve riders while they booked real trips. Almost none of them read the fare and quit outright — they hesitated, scrolled back, checked a competitor app, then came back or didn't. It wasn't the price. It was not knowing why the price was what it was.",
        background: '#1b288d',
        titleColor: '#f6f6f6',
        titleSize: '54',
        titleX: 10, titleY: 15, titleWidth: 256,
        bodyColor: '#00f2e2',
        bodySize: '12',
        bodyX: 10.6, bodyY: 53.2, bodyWidth: 270,
      },
      {
        title: "One Line, Under the Fare.",
        subtitle: "We added a single sentence under the estimate: 'Prices are higher right now — more people are requesting rides nearby.' No dropdown, no info icon to tap. Just a line, already there.",
        background: '#ffffff',
        titleColor: '#1b288d',
        titleSize: '36',
        titleX: 10, titleY: 15, titleWidth: 256,
        bodyColor: '#1b288d',
        bodySize: '16',
        bodyX: 9.6, bodyY: 45.4, bodyWidth: 256,
      },
      {
        subtitle: "Drop-off at the fare screen fell by eleven points in the first month. Nobody praised the redesign in a meeting. It was one sentence. But it was the sentence riders needed before they'd trust the tap.",
        background: '#1b288d',
        bodyColor: '#00f2e2',
        bodySize: '16',
        bodyX: 7.3, bodyY: 52.7, bodyWidth: 272,
      },
    ],
  },
  {
    id: 'bold-poster-photo',
    name: 'Bold Poster — Photo',
    framework: 'Generic 4-beat',
    category: 'Design',
    displayFont: { family: 'Anton', weight: '400' },
    accentFont: { family: 'Inter', weight: '400' },
    colors: {
      background: '#2F39A9',
      title: '#f9faff',
      body: '#00f2e2',
    },
    cards: [
      {
        title: "THE LAST TAP",
        background: '#2F39A9',
        titleColor: '#f9faff',
        titleSize: '85',
        allCaps: true,
        titleX: 10.2, titleY: 7.6, titleWidth: 237,
      },
      {
        subtitle: "Our booking flow had five screens between opening the app and confirming a ride.",
        background: '#1b288d',
        bodyColor: '#f9faff',
        bodySize: '19',
        bodyX: 5.6, bodyY: 55, bodyWidth: 286,
        image: {
          url: 'https://media.base44.com/images/public/6a161402f22a3ebcce243595/d24edfcb8_generated_image.png',
          treatment: 'full-bleed',
          overlayColor: '#1b288d',
          overlayIntensity: 85,
        },
      },
      {
        subtitle: "Internal data showed 40% of users who started a booking never finished it, and most of them disappeared on screen three, the fare estimate.",
        background: '#ffffff',
        bodyColor: '#2F39A9',
        bodySize: '19',
        bodyX: 5.6, bodyY: 7.1, bodyWidth: 286,
      },
      {
        title: "Screen Three.",
        subtitle: "We sat with twelve riders while they booked real trips. Almost none of them read the fare and quit outright — they hesitated, scrolled back, checked a competitor app, then came back or didn't. It wasn't the price. It was not knowing why the price was what it was.",
        background: '#1b288d',
        titleColor: '#f6f6f6',
        titleSize: '54',
        titleX: 10, titleY: 15, titleWidth: 256,
        bodyColor: '#00f2e2',
        bodySize: '12',
        bodyX: 10.6, bodyY: 53.2, bodyWidth: 270,
      },
      {
        title: "One Line, Under the Fare.",
        subtitle: "We added a single sentence under the estimate: 'Prices are higher right now — more people are requesting rides nearby.' No dropdown, no info icon to tap. Just a line, already there.",
        background: '#ffffff',
        titleColor: '#1b288d',
        titleSize: '36',
        titleX: 10, titleY: 15, titleWidth: 256,
        bodyColor: '#1b288d',
        bodySize: '16',
        bodyX: 9.6, bodyY: 45.4, bodyWidth: 256,
      },
      {
        subtitle: "Drop-off at the fare screen fell by eleven points in the first month. Nobody praised the redesign in a meeting. It was one sentence. But it was the sentence riders needed before they'd trust the tap.",
        background: '#1b288d',
        bodyColor: '#00f2e2',
        bodySize: '16',
        bodyX: 7.3, bodyY: 36, bodyWidth: 272,
        image: {
          url: 'https://media.base44.com/images/public/6a161402f22a3ebcce243595/bf7266a5f_generated_image.png',
          treatment: 'top-third',
        },
      },
    ],
  },
];

// Templates shown in the picker (new-story selection).
// Only Bold Poster is active during development; others are retained for
// backward compatibility with existing stories built from them.
export const PICKER_TEMPLATES = STORY_TEMPLATES.filter(t => t.id === 'bold-poster' || t.id === 'bold-poster-photo');

const SAFE_ZONE_INSET = 16;

// Estimate the y position (as % of card height) that vertically centers
// a body-only text block within the safe zone.
function estimateCenteredY(text, fontSizeStr, displayWidth) {
  const fontSize = parseInt(fontSizeStr) || 16;
  const charsPerLine = Math.max(1, Math.floor((displayWidth - 8) / (fontSize * 0.55)));
  const lineCount = Math.ceil(text.length / charsPerLine);
  const lineHeightPx = fontSize * 1.3;
  const textHeightPx = lineCount * lineHeightPx;
  const safeZonePx = REFERENCE_CARD_SIZE - 2 * SAFE_ZONE_INSET;
  const centeredPx = Math.max(SAFE_ZONE_INSET, (safeZonePx - textHeightPx) / 2 + SAFE_ZONE_INSET);
  return Math.round(centeredPx / REFERENCE_CARD_SIZE * 100 * 10) / 10;
}

// Build card objects from a template definition.
// stable=true → deterministic IDs (for previews); stable=false → unique IDs (for real use).
export function buildTemplateCards(template, stable = false) {
  const ts = stable ? '' : `-${Date.now()}`;
  const rnd = stable ? '' : `-${Math.random().toString(36).slice(2)}`;
  const defaultBg = template.colors?.background || '#FFFFFF';
  const defaultTitleColor = template.colors?.title || '#000000';
  const defaultBodyColor = template.colors?.body || '#000000';
  const defaultTitleSize = template.titleSize || TITLE_SIZE;
  const defaultBodySize = template.bodySize || SUBTITLE_SIZE;

  return template.cards.map((cardDef, i) => {
    const cardId = stable
      ? `tpl-${template.id}-${i}`
      : `tpl-${template.id}-${i}${ts}${rnd}`;

    const elements = [];
    let backgroundImageId = undefined;
    const hasSubtitle = !!cardDef.subtitle;
    const hasTitle = !!cardDef.title;
    const cardBg = cardDef.background || defaultBg;
    const titleColor = cardDef.titleColor || defaultTitleColor;
    const bodyColor = cardDef.bodyColor || defaultBodyColor;
    const titleSize = cardDef.titleSize || defaultTitleSize;
    const bodySize = cardDef.bodySize || defaultBodySize;

    // ── Image element (full-bleed background or top-third inset) ──
    if (cardDef.image) {
      if (cardDef.image.treatment === 'full-bleed') {
        elements.push({
          id: `${cardId}-bg`,
          type: 'image',
          image_url: cardDef.image.url,
          crop_ratio: 'original',
          x: 0, y: 0,
          displayWidth: REFERENCE_CARD_SIZE, displayHeight: REFERENCE_CARD_SIZE,
          clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
          z_index: 0,
          ai_generated: true,
          overlay_type: 'Color',
          overlay_color: cardDef.image.overlayColor || cardBg,
          overlay_position: 'Bottom',
          overlay_intensity: cardDef.image.overlayIntensity ?? 85,
        });
        backgroundImageId = `${cardId}-bg`;
      } else if (cardDef.image.treatment === 'top-third') {
        elements.push({
          id: `${cardId}-bg`,
          type: 'image',
          image_url: cardDef.image.url,
          crop_ratio: 'original',
          x: 0, y: 0,
          displayWidth: REFERENCE_CARD_SIZE,
          displayHeight: Math.round(REFERENCE_CARD_SIZE / 3),
          z_index: 0,
          ai_generated: true,
        });
      }
    }

    if (cardDef.title) {
      elements.push({
        id: `${cardId}-title`,
        type: 'text',
        content: cardDef.title,
        x: cardDef.titleX ?? 10,
        y: cardDef.titleY ?? (hasSubtitle ? 15 : 38),
        font_family: template.displayFont.family,
        font_size: titleSize,
        font_weight: template.displayFont.weight,
        font_italic: false,
        font_underline: false,
        font_strikethrough: false,
        text_align: 'left',
        color: titleColor,
        text_transform: cardDef.allCaps ? 'uppercase' : undefined,
        font_size_locked: true,
        z_index: 1000,
        displayWidth: cardDef.titleWidth ?? TEXT_WIDTH,
        displayHeight: 0,
      });
    }

    if (cardDef.subtitle) {
      elements.push({
        id: `${cardId}-subtitle`,
        type: 'text',
        content: cardDef.subtitle,
        x: cardDef.bodyX ?? 10,
        y: hasTitle ? (cardDef.bodyY ?? 58) : (cardDef.bodyY ?? estimateCenteredY(cardDef.subtitle, bodySize, cardDef.bodyWidth ?? TEXT_WIDTH)),
        font_family: template.accentFont.family,
        font_size: bodySize,
        font_weight: template.accentFont.weight,
        font_italic: !!template.accentFont.italic,
        font_underline: false,
        font_strikethrough: false,
        text_align: 'left',
        color: bodyColor,
        font_size_locked: true,
        z_index: 1001,
        displayWidth: cardDef.bodyWidth ?? TEXT_WIDTH,
        displayHeight: 0,
      });
    }

    return {
      id: cardId,
      background_color: cardBg,
      elements,
      backgroundImageId,
    };
  });
}

// Check if the current story is fresh (no meaningful content).
// Fresh = exactly 1 card with no elements or only empty text elements.
export function isFreshStory(cards) {
  if (!cards || cards.length !== 1) return false;
  const elements = cards[0].elements || [];
  return elements.length === 0 || elements.every(el =>
    el.type === 'text' && !(el.content && el.content.trim())
  );
}

// Apply a template to an existing story with content carry-over by position.
// - Fresh story → use template's own copy
// - Story with content → carry over text/image by card position
// - Overflow (more old cards than template) → merge leftovers into one extra card
export function applyTemplateToStory(template, oldCards, forceFresh = false) {
  const templateCards = buildTemplateCards(template);

  if (forceFresh || isFreshStory(oldCards)) {
    return templateCards;
  }

  // Carry over content by position
  const newCards = templateCards.map((tCard, i) => {
    const oldCard = oldCards[i];
    if (!oldCard) return tCard; // No old card — keep template's own copy

    // Extract old text elements (non-empty, sorted by z-index)
    const oldTexts = (oldCard.elements || [])
      .filter(el => el.type === 'text' && el.content && el.content.trim())
      .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));

    // Extract old image/video elements
    const oldImages = (oldCard.elements || [])
      .filter(el => el.type === 'image' || el.type === 'video');

    // Map old texts into template's text elements by position
    const tTextEls = tCard.elements.filter(el => el.type === 'text');
    let textIdx = 0;
    const newElements = tCard.elements.map(el => {
      if (el.type === 'text') {
        const oldText = oldTexts[textIdx++];
        if (oldText) {
          return { ...el, content: oldText.content };
        }
        return el; // Keep template's own copy if no old text at this position
      }
      return el;
    });

    // If old card has an image, add it as a background fill image
    if (oldImages.length > 0) {
      const img = oldImages[0];
      const bgEl = {
        ...img,
        id: `${tCard.id}-bg-${Math.random().toString(36).slice(2)}`,
        crop_ratio: 'original',
        x: 0,
        y: 0,
        displayWidth: REFERENCE_CARD_SIZE, displayHeight: REFERENCE_CARD_SIZE,
        clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
        z_index: 0,
      };
      newElements.unshift(bgEl);
      return {
        ...tCard,
        elements: newElements,
        backgroundImageId: bgEl.id,
      };
    }

    return { ...tCard, elements: newElements };
  });

  // Handle overflow: old story has more cards than template
  if (oldCards.length > templateCards.length) {
    const leftoverCards = oldCards.slice(templateCards.length);

    // Collect all text from leftover cards
    const leftoverTexts = leftoverCards
      .flatMap(c => (c.elements || []).filter(el => el.type === 'text' && el.content && el.content.trim()))
      .map(el => el.content);

    // Collect first image from leftover cards (drop the rest — recoverable via draft)
    const leftoverImages = leftoverCards
      .flatMap(c => (c.elements || []).filter(el => el.type === 'image' || el.type === 'video'));

    const lastTemplateCard = templateCards[templateCards.length - 1];
    const mergeCardId = `tpl-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const mergeElements = [];

    // Plain text — small, regular weight, no headline/subtitle distinction
    if (leftoverTexts.length > 0) {
      mergeElements.push({
        id: `${mergeCardId}-text`,
        type: 'text',
        content: leftoverTexts.join('\n\n'),
        x: 10,
        y: 20,
        font_family: 'Inter',
        font_size: '10',
        font_weight: '400',
        font_italic: false,
        font_underline: false,
        font_strikethrough: false,
        text_align: 'left',
        color: '#000000',
        z_index: 1000,
        displayWidth: TEXT_WIDTH,
        displayHeight: 0,
      });
    }

    // Keep only the first leftover card's image as background
    if (leftoverImages.length > 0) {
      const img = leftoverImages[0];
      const bgEl = {
        ...img,
        id: `${mergeCardId}-bg`,
        crop_ratio: 'original',
        x: 0,
        y: 0,
        displayWidth: REFERENCE_CARD_SIZE, displayHeight: REFERENCE_CARD_SIZE,
        clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
        z_index: 0,
      };
      mergeElements.unshift(bgEl);
    }

    newCards.push({
      id: mergeCardId,
      background_color: lastTemplateCard.background_color,
      elements: mergeElements,
      backgroundImageId: leftoverImages.length > 0 ? `${mergeCardId}-bg` : undefined,
    });
  }

  return newCards;
}