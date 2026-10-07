import { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET } from './CanvasArea';
import AudioWidget from './AudioWidget';
import TrimmedVideo from './TrimmedVideo';
import { useDraftMedia } from './DraftMediaContext';
import { resolveColor } from '@/lib/colorTokens';
import { getTextEffectStyle, hasTextWarp } from '@/lib/textEffects';
import { getTextBoxLayout } from '@/lib/textLayout';
import WarpedText from './WarpedText';

// Replicates buildOverlayStyle from DraggableElement (non-interactive thumbnail version)
function buildOverlayStyle(element) {
  const { overlay_type, overlay_position, overlay_intensity, overlay_color } = element;
  if (!overlay_type || overlay_type === 'None') return null;
  const intensity = (overlay_intensity ?? 50) / 100;
  const dir = { Bottom: 'to top', Top: 'to bottom', Left: 'to right', Right: 'to left' }[overlay_position || 'Bottom'] || 'to top';
  if (overlay_type === 'Dark') {
    return { background: `linear-gradient(${dir}, rgba(0,0,0,${intensity}) 0%, transparent 100%)` };
  }
  if (overlay_type === 'Color') {
    const hex = overlay_color || '#000000';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { background: `linear-gradient(${dir}, rgba(${r},${g},${b},${intensity}) 0%, transparent 100%)` };
  }
  return null;
}

const isImageLike = (t) => t === 'image' || t === 'video';

// Snapshot render with scale transform: content is laid out once in a fixed
// REFERENCE_CARD_SIZE coordinate space, then scaled to the display size with a
// single CSS transform. Text never reflows and proportions are identical at
// any display size — matching the creator canvas exactly.
export default function CardThumb({ card, displaySize = 64, autoplay = false, tokens = [] }) {
  const refSize = REFERENCE_CARD_SIZE;
  const scale = displaySize / refSize;
  const elements = [...(card.elements || [])].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  const cardBg = resolveColor(card.background_token, tokens, card.background_color || '#FFFFFF');
  const { resolveMediaUrl } = useDraftMedia();

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: cardBg }}>
      
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: refSize,
          height: refSize,
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}>
        
        {elements.map((el) => {
          if (isImageLike(el.type)) {
            const cropRatio = el.crop_ratio || 'fill';
            const zoom = el.zoom ?? 100;
            const focalX = el.focalX ?? 50;
            const focalY = el.focalY ?? 50;
            const overlayStyle = buildOverlayStyle(el);
            const isBlur = el.overlay_type === 'Blur';
            const blurStrength = (el.overlay_intensity ?? 50) / 100 * 12;
            const blurDir = { Bottom: 'to top', Top: 'to bottom', Left: 'to right', Right: 'to left' }[el.overlay_position || 'Bottom'];
            const isVideo = el.type === 'video';

            // Non-fill — outer visible area + inner media translated for crop.
            const hasNewModel = el.displayWidth != null;
            let displayWidth, displayHeight;
            if (hasNewModel) {
              displayWidth = el.displayWidth;
              displayHeight = el.displayHeight ?? displayWidth;
            } else {
              displayWidth = (el.width ?? 80) / 100 * refSize;
              const ratioParts = cropRatio !== 'original' && cropRatio !== 'fill' ? cropRatio.split('/').map(Number) : null;
              const aspect = ratioParts && ratioParts[0] && ratioParts[1] ? ratioParts[0] / ratioParts[1] : null;
              displayHeight = el.height != null ? el.height / 100 * refSize : aspect ? displayWidth / aspect : displayWidth;
            }
            const clipTop = el.clipTop || 0,clipBottom = el.clipBottom || 0;
            const clipLeft = el.clipLeft || 0,clipRight = el.clipRight || 0;
            const visibleW = Math.max(20, displayWidth - clipLeft - clipRight);
            const visibleH = Math.max(20, displayHeight - clipTop - clipBottom);

            return (
              <div key={el.id} className="absolute" style={{
                left: `${el.x ?? 0}%`, top: `${el.y ?? 0}%`,
                width: visibleW, height: visibleH,
                zIndex: el.z_index ?? 1, overflow: 'hidden', borderRadius: el.borderRadius || 0
              }}>
                <div style={{ position: 'absolute', left: -clipLeft, top: -clipTop, width: displayWidth, height: displayHeight }}>
                  {isVideo ?
                  <TrimmedVideo src={resolveMediaUrl(el.image_url)} draggable={false}
                  autoPlay={autoplay} muted loop
                  trimStart={el.trimStart || 0} trimEnd={el.trimEnd || 0}
                  className="w-full h-full pointer-events-none"
                  style={{ objectFit: 'cover', objectPosition: `${focalX}% ${focalY}%`, transform: `scale(${zoom / 100}) rotate(${el.rotation || 0}deg) scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})`, transformOrigin: 'center center' }} /> :


                  <img src={resolveMediaUrl(el.image_url)} alt="" draggable={false}
                  loading="lazy" decoding="async"
                  className="w-full h-full pointer-events-none"
                  style={{ objectFit: 'cover', objectPosition: `${focalX}% ${focalY}%`, transform: `scale(${zoom / 100}) rotate(${el.rotation || 0}deg) scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})`, transformOrigin: 'center center' }} />

                  }
                </div>
                {overlayStyle && <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />}
                {isBlur &&
                <div className="absolute inset-0 pointer-events-none"
                style={{ backdropFilter: `blur(${blurStrength}px)`, WebkitBackdropFilter: `blur(${blurStrength}px)`,
                  background: `linear-gradient(${blurDir}, rgba(0,0,0,0.01) 0%, transparent 60%)` }} />
                }
              </div>);

          }

          // Audio element — interactive player widget on profile/preview.
          if (el.type === 'audio') {
            const displayWidth = el.displayWidth ?? 220;
            const displayHeight = el.displayHeight ?? 60;
            return (
              <div key={el.id} className="absolute" style={{
                left: `${el.x ?? 10}%`, top: `${el.y ?? 40}%`,
                width: displayWidth, height: displayHeight,
                zIndex: el.z_index ?? 1
              }}>
                <AudioWidget
                  url={resolveMediaUrl(el.image_url)}
                  duration={el.duration}
                  width={displayWidth}
                  height={displayHeight}
                  interactive={autoplay}
                  cardBg={cardBg}
                  trimStart={el.trimStart || 0}
                  trimEnd={el.trimEnd || 0} />
                
              </div>);

          }

          // Text element — raw font size in ref space; the transform scales it.
          // displayWidth controls the box width. displayHeight is only a
          // resize-handle affordance in the editor, never a hard clip — the
          // editor itself renders text with overflow: visible so content is
          // never cut off there regardless of the stored height. This must
          // match that behavior (overflow: visible, no fixed height) or a
          // text box whose saved displayHeight is smaller than its actual
          // content — e.g. after a paste that didn't grow it — would show
          // full text in the editor but get silently clipped here, in the
          // preview and on the published card. maxHeight stays only as a
          // generous safety cap, same value the editor itself uses.
          const baseFontSize = el.font_size ? parseInt(el.font_size) : 14;
          // Same safe-zone clamping of position and width as the editor
          // (shared helper) — using the raw stored x/displayWidth here made
          // boxes near the edge jump and re-wrap on publish.
          const { xPct, yPct, width: textWidth } = getTextBoxLayout(el);
          const textDeco = [
            el.font_underline ? 'underline' : '',
            el.font_strikethrough ? 'line-through' : '',
          ].filter(Boolean).join(' ') || 'none';
          // Warped text draws its own per-letter decoration (WarpedText.jsx).
          const warped = hasTextWarp(el);
          return (
            <div key={el.id} className="absolute"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: textWidth,
              maxHeight: refSize - 2 * SAFE_ZONE_INSET,
              zIndex: el.z_index ?? 1000,
              padding: 2,
              overflow: 'visible'
            }}>
              <div
                className="whitespace-pre-wrap break-words"
                style={{
                  fontSize: baseFontSize,
                  width: textWidth - 4,
                  fontWeight: el.font_weight || '400',
                  color: resolveColor(el.color_token, tokens, el.color || '#000000'),
                  fontFamily: el.font_family || 'Inter',
                  lineHeight: baseFontSize >= 32 ? '1.05' : '1.3',
                  fontStyle: el.font_italic ? 'italic' : 'normal',
                  textAlign: el.text_align || 'left',
                  textDecoration: warped ? 'none' : textDeco,
                  textTransform: el.text_transform || 'none',
                  ...getTextEffectStyle(el, 1)
                }}>
                
                {warped
                  ? <WarpedText text={el.content || ''} warp={el.text_warp} amount={el.text_warp_amount} decoration={textDeco} />
                  : (el.content || '')}
              </div>
            </div>);

        })}
      </div>
    </div>);

}