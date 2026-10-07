// Full (uncropped) box of an image/video element in reference px.
// Elements saved before displayWidth/displayHeight existed only stored
// width/height as % of the card (height optional, derived from the crop
// ratio). Shared by every renderer and the media panel so they all agree on
// the size of legacy elements.
// refSize is passed in (REFERENCE_CARD_SIZE) rather than imported, to keep
// this file free of the CanvasArea import cycle (see textLayout.js).
export function getImageDisplayDims(el, refSize) {
  if (el.displayWidth != null) {
    return { displayWidth: el.displayWidth, displayHeight: el.displayHeight ?? el.displayWidth };
  }
  const cropRatio = el.crop_ratio || 'fill';
  const displayWidth = ((el.width ?? 80) / 100) * refSize;
  const ratioParts = cropRatio !== 'original' && cropRatio !== 'fill' ? cropRatio.split('/').map(Number) : null;
  const aspect = ratioParts && ratioParts[0] && ratioParts[1] ? ratioParts[0] / ratioParts[1] : null;
  const displayHeight = el.height != null ? (el.height / 100) * refSize : aspect ? displayWidth / aspect : displayWidth;
  return { displayWidth, displayHeight };
}
