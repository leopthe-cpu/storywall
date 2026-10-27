// Card geometry shared by the editor and every read-only render. Lives in
// its own tiny file so a wall can draw cards (CardThumb) without pulling in
// the editor canvas (CanvasArea → DraggableElement → panels), which made
// the whole builder part of every page's download.

// Reference card size: all element coordinates/sizes are stored relative to this.
export const REFERENCE_CARD_SIZE = 320;

// Inset (px in reference space) of the safe-zone guide border. Text boxes
// are capped to this boundary so content never overflows past it.
export const SAFE_ZONE_INSET = 16;

// Card sizes (decision 45, revised by Oz 2026-10-27: each CARD has its own
// size, so a story can mix them). Width is always REFERENCE_CARD_SIZE, so
// the scale a renderer applies (card width / 320) and every stored width,
// height, font size and crop stay the same in every size; only the card's
// height changes. x is a % of the card's width, y a % of its height — on a
// 1:1 card those are the same number, which is why existing stories don't
// move. A card stores its size as `card_size` inside posts.cards (jsonb, no
// migration); posts.card_size is only the fallback for cards saved before
// that (cardSizeOf). Export sizes are the usual social-media ones.
export const CARD_SIZES = {
  '1:1': { id: '1:1', label: 'Square', width: REFERENCE_CARD_SIZE, height: REFERENCE_CARD_SIZE, exportWidth: 1080, exportHeight: 1080 },
  '4:5': { id: '4:5', label: 'Portrait', width: REFERENCE_CARD_SIZE, height: 400, exportWidth: 1080, exportHeight: 1350 },
  // 320 × 16/9 = 568.9; 569 keeps every coordinate a whole pixel.
  '9:16': { id: '9:16', label: 'Story', width: REFERENCE_CARD_SIZE, height: 569, exportWidth: 1080, exportHeight: 1920 },
  '16:9': { id: '16:9', label: 'Landscape', width: REFERENCE_CARD_SIZE, height: 180, exportWidth: 1920, exportHeight: 1080 },
};

// The order sizes are offered in (add-card menu, size switcher).
export const CARD_SIZE_ORDER = ['1:1', '4:5', '9:16', '16:9'];

// Sizes the layout engine (Generate, framework templates) lays out well.
// 9:16 and 16:9 aren't offered there yet: its photo and text rules were
// made for square-ish cards.
export const LAYOUT_CARD_SIZES = ['4:5', '1:1'];

// What a card without a size is (every card saved before decision 45, and
// the posts.card_size column's default).
export const LEGACY_CARD_SIZE = '1:1';

// The size a new story's first card starts at (decision 45, Oz 2026-10-26):
// portrait, the Instagram/LinkedIn carousel format.
export const DEFAULT_NEW_CARD_SIZE = '4:5';

// A size's dimensions; anything unknown or missing falls back to square.
export function getCardSize(cardSize) {
  return CARD_SIZES[cardSize] || CARD_SIZES[LEGACY_CARD_SIZE];
}

// A card's size id: its own, else its story's (`fallback`, from
// posts.card_size or CardFormatContext), else square.
export function cardSizeOf(card, fallback) {
  return getCardSize(card?.card_size || fallback).id;
}

// CSS aspect-ratio of a size ('320 / 400' for 4:5), for boxes that hold a
// card before it's drawn (wall placeholders, thumbnails).
export function cardAspectRatio(cardSize) {
  const { width, height } = getCardSize(cardSize);
  return `${width} / ${height}`;
}

// On-screen box for a card of `cardSize` fitted inside maxWidth × maxHeight
// (whole px), keeping its shape. Thumbnails use a box as wide as the old
// square ones and as tall as a 4:5 card of that width, so a 9:16 card gets
// narrower instead of making its row very tall, and 16:9 gets shorter.
export function fitCard(cardSize, maxWidth, maxHeight = maxWidth) {
  const { width, height } = getCardSize(cardSize);
  const s = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * s), height: Math.round(height * s) };
}
