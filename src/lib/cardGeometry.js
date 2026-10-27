// Card geometry shared by the editor and every read-only render. Lives in
// its own tiny file so a wall can draw cards (CardThumb) without pulling in
// the editor canvas (CanvasArea → DraggableElement → panels), which made
// the whole builder part of every page's download.

// Reference card size: all element coordinates/sizes are stored relative to this.
export const REFERENCE_CARD_SIZE = 320;

// Inset (px in reference space) of the safe-zone guide border. Text boxes
// are capped to this boundary so content never overflows past it.
export const SAFE_ZONE_INSET = 16;

// Card sizes (decision 45). Every card of a story has its story's size
// (posts.card_size). Width is always REFERENCE_CARD_SIZE, so the scale a
// renderer applies (card width / 320) and every stored width, height, font
// size and crop stay the same in every size; only the card's height
// changes. x is a % of the card's width, y a % of its height — on a 1:1
// card those are the same number, which is why existing stories don't move.
// To add 16:9 or 9:16: add an entry here and widen posts_card_size_check.
export const CARD_SIZES = {
  '1:1': { id: '1:1', label: 'Square', width: REFERENCE_CARD_SIZE, height: REFERENCE_CARD_SIZE, exportWidth: 1080, exportHeight: 1080 },
  '4:5': { id: '4:5', label: 'Portrait', width: REFERENCE_CARD_SIZE, height: 400, exportWidth: 1080, exportHeight: 1350 },
};

// What a story without a size is (every story saved before decision 45, and
// the database column's default).
export const LEGACY_CARD_SIZE = '1:1';

// The size a new story starts at (decision 45, Oz 2026-10-26): portrait,
// the Instagram/LinkedIn carousel format. 1:1 stays available.
export const DEFAULT_NEW_CARD_SIZE = '4:5';

// A story's card size; anything unknown or missing falls back to square.
export function getCardSize(cardSize) {
  return CARD_SIZES[cardSize] || CARD_SIZES[LEGACY_CARD_SIZE];
}

// CSS aspect-ratio of a story's cards ('320 / 400' for 4:5), for boxes that
// hold a card before it's drawn (wall placeholders, thumbnails).
export function cardAspectRatio(cardSize) {
  const { width, height } = getCardSize(cardSize);
  return `${width} / ${height}`;
}
