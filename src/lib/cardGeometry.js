// Card geometry shared by the editor and every read-only render. Lives in
// its own tiny file so a wall can draw cards (CardThumb) without pulling in
// the editor canvas (CanvasArea → DraggableElement → panels), which made
// the whole builder part of every page's download.

// Reference card size: all element coordinates/sizes are stored relative to this.
export const REFERENCE_CARD_SIZE = 320;

// Inset (px in reference space) of the safe-zone guide border. Text boxes
// are capped to this boundary so content never overflows past it.
export const SAFE_ZONE_INSET = 16;
