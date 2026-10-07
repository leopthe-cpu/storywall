import { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET } from '@/components/creator/CanvasArea';

// Where a text box actually sits and how wide it is, in reference px on the
// 320×320 card. This is the single source of truth for BOTH the editor
// (DraggableElement) and every read-only render (CardThumb: thumbnails,
// publish preview, the published card, image export).
//
// Why it exists: displayWidth/x/y are stored unclamped, and the editor
// visually pulls a box back inside the safe zone when it would overflow the
// right/bottom edge, and caps its width at the safe zone. CardThumb used to
// render the raw stored values instead, so any box near the edge (or saved
// wider than the safe zone) jumped and re-wrapped on publish — the user's
// design silently changed. Both renderers must call this; never re-derive
// these numbers per file.
//
// Constants are read inside the function, not at module top level:
// CanvasArea → DraggableElement → this file → CanvasArea is an import cycle,
// so top-level use of REFERENCE_CARD_SIZE could run before it's defined.
export function getTextBoxLayout(element) {
  const SAFE_ZONE_SIZE = REFERENCE_CARD_SIZE - 2 * SAFE_ZONE_INSET;
  const rawWidth = element.displayWidth || REFERENCE_CARD_SIZE * 0.8;
  const rawHeight = element.displayHeight || 0;

  // Visual dimensions: clamp to the safe zone.
  const width = Math.min(rawWidth, SAFE_ZONE_SIZE);
  const height = rawHeight > 0 ? Math.min(rawHeight, SAFE_ZONE_SIZE) : 0;

  // Keep the box inside the safe zone by moving it, not shrinking it.
  const leftPx = ((element.x ?? 16) / 100) * REFERENCE_CARD_SIZE;
  const topPx = ((element.y ?? 20) / 100) * REFERENCE_CARD_SIZE;
  let xPct = element.x ?? 16;
  let yPct = element.y ?? 20;
  if (leftPx + width > REFERENCE_CARD_SIZE - SAFE_ZONE_INSET) {
    xPct = Math.max(SAFE_ZONE_INSET, REFERENCE_CARD_SIZE - SAFE_ZONE_INSET - width) / REFERENCE_CARD_SIZE * 100;
  }
  if (height > 0 && topPx + height > REFERENCE_CARD_SIZE - SAFE_ZONE_INSET) {
    yPct = Math.max(SAFE_ZONE_INSET, REFERENCE_CARD_SIZE - SAFE_ZONE_INSET - height) / REFERENCE_CARD_SIZE * 100;
  }

  // width/height in reference px (height 0 = auto); x/y in % of the card.
  return { xPct, yPct, width, height };
}
