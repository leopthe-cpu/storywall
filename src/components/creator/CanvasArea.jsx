import { useRef, useState, useLayoutEffect } from 'react';
import DraggableElement from './DraggableElement';
import { resolveColor } from '@/lib/colorTokens';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Reference card size — all element coordinates/sizes are stored relative to this
export const REFERENCE_CARD_SIZE = 320;

// Inset (px in reference space) of the safe-zone guide border. Text boxes
// are capped to this boundary so content never overflows past it.
export const SAFE_ZONE_INSET = 16;

export default function CanvasArea({ card, cardSize, selectedElementId, onSelectElement, onUpdateElement, autoEditId, onAutoEditConsumed, onRetryImageGeneration, tokens }) {
  const canvasRef = useRef(null);
  const scale = cardSize / REFERENCE_CARD_SIZE;
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const [centerGuides, setCenterGuides] = useState({ v: false, h: false });
  // Element-to-element alignment lines while dragging, in % of the card.
  const [alignGuides, setAlignGuides] = useState({ v: [], h: [] });
  // Press-and-hold on an element hides all the others (incl. a background
  // picture) until release — display only, element data is untouched.
  const [heldElementId, setHeldElementId] = useState(null);

  // Compute available height for each text element based on the group layout.
  // Each text box gets the space from its y position to the next text box's y
  // position (or the safe zone bottom), minus a small gap. This coordinates
  // sizing across all text boxes on the card — no box grows into another's space.
  const textElements = (card?.elements || [])
    .filter(e => e.type === 'text')
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  const textAvailableHeights = {};
  textElements.forEach((el, i) => {
    const yPx = ((el.y ?? 20) / 100) * REFERENCE_CARD_SIZE;
    const nextYPx = i < textElements.length - 1
      ? ((textElements[i + 1].y ?? 80) / 100) * REFERENCE_CARD_SIZE
      : REFERENCE_CARD_SIZE - SAFE_ZONE_INSET;
    textAvailableHeights[el.id] = Math.max(20, nextYPx - yPx - 4);
  });

  // Card-level coordinated shrink: after render, measure all text boxes.
  // If their combined height exceeds the safe zone, shrink all font sizes
  // proportionally (maintaining relative proportions) until the group fits.
  // Only applies to a card's untouched, freshly-AI-generated text (every box
  // still unlocked) — this is initial AI-shaping math, not a builder-editing
  // feature. The moment any box on the card is locked (a manual edit on an
  // AI-generated story, or a manually-added box, which locks at creation),
  // this safety net stops running for that card entirely.
  const textSig = textElements.map(e => `${e.id}:${e.font_size}:${e.content?.length || 0}:${!!e.font_size_locked}`).join('|');
  useLayoutEffect(() => {
    if (!canvasRef.current || textElements.length < 2) return;
    if (textElements.some(el => el.font_size_locked)) return;
    const nodes = canvasRef.current.querySelectorAll('[data-text-element-id]');
    if (nodes.length < 2) return;
    const safeZonePx = (REFERENCE_CARD_SIZE - 2 * SAFE_ZONE_INSET) * scale;
    let totalHeight = 0;
    nodes.forEach(node => { totalHeight += node.offsetHeight; });
    if (totalHeight > safeZonePx + 2) {
      const shrinkFactor = safeZonePx / totalHeight;
      textElements.forEach(el => {
        const currentSize = parseInt(el.font_size) || 14;
        const minSize = el.text_type === 'body' ? 12 : 8;
        const newSize = Math.max(minSize, Math.floor(currentSize * shrinkFactor));
        if (newSize < currentSize) {
          onUpdateElement(el.id, { font_size: String(newSize) });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSig, scale]);

  // Tapping anywhere on the card that isn't an element deselects. It used to
  // check only for the canvas node itself, but the full-size content layer
  // sits on top of it, so taps on empty card space never deselected.
  const handleCanvasClick = (e) => {
    if (!e.target.closest('[data-canvas-el]')) {
      onSelectElement(null);
    }
  };

  return (
    <div
      ref={canvasRef}
      data-card-canvas
      className="canvas-bg relative rounded-2xl cursor-default flex-shrink-0"
      style={{
        width: cardSize,
        height: cardSize,
        backgroundColor: card ? resolveColor(card.background_token, tokens, card.background_color || '#FFFFFF') : '#FFFFFF',
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
        isolation: 'isolate',
        overflow: 'hidden',
      }}
      onClick={handleCanvasClick}
    >
      {/* Scaled content container. The canvas div clips to rounded corners
          via overflow:hidden + rounded-2xl, so no clip-path is needed here.
          clip-path would clip resize/crop handles at the card edges. */}
      <div
        className="absolute inset-0"
        style={{
          transformOrigin: 'top left',
        }}
      >
        {card?.elements?.map(el => (
          <DraggableElement
            key={el.id}
            element={el}
            scale={scale}
            isSelected={el.id === selectedElementId}
            onSelect={(id) => onSelectElement(id ?? el.id)}
            onUpdate={(updates) => onUpdateElement(el.id, updates)}
            canvasBounds={canvasRef}
            cardSize={cardSize}
            autoEdit={el.id === autoEditId}
            onAutoEditConsumed={onAutoEditConsumed}
            cardBg={resolveColor(card.background_token, tokens, card.background_color || '#FFFFFF')}
            onDragStateChange={setIsDragging}
            onCenterGuideChange={setCenterGuides}
            onAlignGuideChange={setAlignGuides}
            onHoldChange={setHeldElementId}
            hiddenByHold={!!heldElementId && heldElementId !== el.id}
            availableHeight={textAvailableHeights[el.id]}
            tokens={tokens}
            isHovered={!selectedElementId && hoveredElementId === el.id}
            onHover={setHoveredElementId}
          />
        ))}
      </div>

      {/* Image generation failed marker — visible retry affordance */}
      {card.imageGenerationFailed && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 5000 }}>
          <div className="bg-red-500/90 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2">
            <span>⚠ Image generation failed</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRetryImageGeneration?.(card); }}
              className="bg-white text-red-500 px-2 py-0.5 rounded text-xs font-bold hover:bg-white/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Image retrying indicator */}
      {card.imageRetrying && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 5000 }}>
          <div className="bg-black/80 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2">
            <PixelSpinner size={14} tone="light" />
            <span>Generating image…</span>
          </div>
        </div>
      )}

      {/* Smart guides — center-alignment lines shown while dragging an
          element close to the card's horizontal/vertical center (with snap).
          Rendered above content, below the safe-zone border. */}
      {isDragging && centerGuides.v && (
        <div
          className="absolute pointer-events-none"
          style={{ left: '50%', top: 0, bottom: 0, width: 1, background: '#32CD32', transform: 'translateX(-50%)', zIndex: 9998 }}
        />
      )}
      {isDragging && centerGuides.h && (
        <div
          className="absolute pointer-events-none"
          style={{ top: '50%', left: 0, right: 0, height: 1, background: '#32CD32', transform: 'translateY(-50%)', zIndex: 9998 }}
        />
      )}

      {/* Alignment guides — same look as the center guides, drawn where the
          dragged element lines up with another element's edge or center. */}
      {isDragging && alignGuides.v.map((p) => (
        <div
          key={`av${p}`}
          className="absolute pointer-events-none"
          style={{ left: `${p}%`, top: 0, bottom: 0, width: 1, background: '#32CD32', transform: 'translateX(-50%)', zIndex: 9998 }}
        />
      ))}
      {isDragging && alignGuides.h.map((p) => (
        <div
          key={`ah${p}`}
          className="absolute pointer-events-none"
          style={{ top: `${p}%`, left: 0, right: 0, height: 1, background: '#32CD32', transform: 'translateY(-50%)', zIndex: 9998 }}
        />
      ))}

      {/* Safe zone guide — rendered AFTER content so it's always on top of
          any background image. Lime green (#32CD32) with a subtle dark outline
          for contrast against both photo and solid-color backgrounds. */}
      {isDragging && (
        <div
          className="absolute pointer-events-none rounded-xl"
          style={{
            inset: Math.round(SAFE_ZONE_INSET * scale),
            border: '2px solid #32CD32',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
            zIndex: 9999,
          }}
        />
      )}
    </div>
  );
}