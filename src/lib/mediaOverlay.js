// Photo overlays (Media panel → Overlay), shared by the editor canvas
// (DraggableElement) and CardThumb (thumbnails, publish preview, published
// card) so they can't drift apart.
//
// Positions Bottom/Top/Left/Right fade in from that edge; 'Full' covers the
// whole image evenly.

const GRADIENT_DIR = { Bottom: 'to top', Top: 'to bottom', Left: 'to right', Right: 'to left' };

function hexToRgb(hex) {
  const h = hex || '#000000';
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Dark / Color layer style, or null.
export function buildOverlayStyle(element) {
  const { overlay_type, overlay_position, overlay_intensity, overlay_color } = element;
  if (!overlay_type || overlay_type === 'None') return null;
  const intensity = (overlay_intensity ?? 50) / 100;
  let rgb;
  if (overlay_type === 'Dark') rgb = [0, 0, 0];
  else if (overlay_type === 'Color') rgb = hexToRgb(overlay_color);
  else return null;
  const color = `rgba(${rgb.join(',')},${intensity})`;
  if (overlay_position === 'Full') return { background: color };
  const dir = GRADIENT_DIR[overlay_position || 'Bottom'] || 'to top';
  return { background: `linear-gradient(${dir}, ${color} 0%, transparent 100%)` };
}

// Blur layer style, or null. Strength follows the intensity slider (max 12
// reference px, multiplied by the renderer's scale where it applies one).
export function buildBlurOverlayStyle(element, scale = 1) {
  if (element.overlay_type !== 'Blur') return null;
  const blur = `blur(${((element.overlay_intensity ?? 50) / 100) * 12 * scale}px)`;
  // Edge positions keep their original near-transparent tint gradient.
  // backdrop-filter blurs the whole layer regardless of its background, so
  // for 'Full' a plain transparent layer gives the same even blur.
  const background = element.overlay_position === 'Full'
    ? 'transparent'
    : `linear-gradient(${GRADIENT_DIR[element.overlay_position || 'Bottom']}, rgba(0,0,0,0.01) 0%, transparent 60%)`;
  return { backdropFilter: blur, WebkitBackdropFilter: blur, background };
}
