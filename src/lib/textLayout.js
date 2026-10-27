import { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET } from '@/lib/cardGeometry';

// Where a text box actually sits and how wide it is, in reference px on a
// card 320 wide and `refHeight` high (320 for 1:1, 400 for 4:5 — see
// CARD_SIZES in cardGeometry.js). This is the single source of truth for BOTH the editor
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
export function getTextBoxLayout(element, refHeight = REFERENCE_CARD_SIZE) {
  const refWidth = REFERENCE_CARD_SIZE;
  const SAFE_ZONE_W = refWidth - 2 * SAFE_ZONE_INSET;
  const SAFE_ZONE_H = refHeight - 2 * SAFE_ZONE_INSET;
  const rawWidth = element.displayWidth || refWidth * 0.8;
  const rawHeight = element.displayHeight || 0;

  // Visual dimensions: clamp to the safe zone.
  const width = Math.min(rawWidth, SAFE_ZONE_W);
  const height = rawHeight > 0 ? Math.min(rawHeight, SAFE_ZONE_H) : 0;

  // Keep the box inside the safe zone by moving it, not shrinking it.
  // x is a % of the card's width, y a % of its height.
  const leftPx = ((element.x ?? 16) / 100) * refWidth;
  const topPx = ((element.y ?? 20) / 100) * refHeight;
  let xPct = element.x ?? 16;
  let yPct = element.y ?? 20;
  if (leftPx + width > refWidth - SAFE_ZONE_INSET) {
    xPct = Math.max(SAFE_ZONE_INSET, refWidth - SAFE_ZONE_INSET - width) / refWidth * 100;
  }
  if (height > 0 && topPx + height > refHeight - SAFE_ZONE_INSET) {
    yPct = Math.max(SAFE_ZONE_INSET, refHeight - SAFE_ZONE_INSET - height) / refHeight * 100;
  }

  // width/height in reference px (height 0 = auto); x/y in % of the card.
  return { xPct, yPct, width, height };
}
