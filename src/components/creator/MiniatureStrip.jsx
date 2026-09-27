import CardThumb from '@/components/creator/CardThumb';

// Shared miniature strip with segmented position indicator.
// Used wherever a list of cards is shown as small miniatures (Templates, Drafts, etc.)
//
// The position indicator sits directly UNDER the miniature strip (not above),
// with each segment matching its corresponding miniature's width and position.
// This keeps it legible at small sizes — on full-size published story carousels
// the indicator sits above/at the top of the cards instead.
//
// Props:
//   cards            — array of card objects to render as miniatures
//   tokens           — color tokens for CardThumb rendering
//   activeIndex      — index of the currently shown card (null/undefined = none highlighted)
//   onMiniatureClick — callback(index) when a miniature is tapped
//   thumbSize        — miniature size in px (default 28)
//   gap              — gap between miniatures in px (default 4)
//   offset           — pagination scroll offset in number of cards (default 0)
export default function MiniatureStrip({
  cards,
  tokens,
  activeIndex,
  onMiniatureClick,
  thumbSize = 28,
  gap = 4,
  offset = 0,
}) {
  const STEP = thumbSize + gap;
  const shift = -offset * STEP;
  const hasActive = activeIndex != null && activeIndex >= 0 && activeIndex < cards.length;

  return (
    <div className="flex flex-col gap-1">
      {/* Miniature thumbnails */}
      <div className="overflow-hidden" style={{ height: thumbSize }}>
        <div
          className="flex transition-transform duration-200"
          style={{ transform: `translateX(${shift}px)`, gap }}
        >
          {cards.map((card, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onMiniatureClick(i); }}
              className="flex-shrink-0 rounded overflow-hidden border transition-opacity hover:opacity-100"
              style={{
                width: thumbSize,
                height: thumbSize,
                opacity: hasActive && activeIndex === i ? 1 : 0.6,
                borderColor: hasActive && activeIndex === i ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <CardThumb card={card} displaySize={thumbSize} tokens={tokens} />
            </button>
          ))}
        </div>
      </div>

      {/* Position indicator — one segment per card, directly below each miniature */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-200"
          style={{ transform: `translateX(${shift}px)`, gap }}
        >
          {cards.map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded-full transition-colors"
              style={{
                width: thumbSize,
                height: 3,
                backgroundColor: hasActive && activeIndex === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}