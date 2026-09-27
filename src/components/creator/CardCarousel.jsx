import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CardThumb from '@/components/creator/CardThumb';

// Custom transform-based carousel with scroll-intent passthrough:
// - Touch: touch-action: pan-y lets vertical swipes scroll the page natively;
//   horizontal swipes drag the track. We detect intent and only consume
//   horizontal gestures.
// - Wheel: vertical wheel always passes through to the page; only significant
//   horizontal (trackpad) wheel moves the carousel.
export default function CardCarousel({ cards, onTap, tokens }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [cardW, setCardW] = useState(320);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);

  // Reset/clamp when the card set changes or viewport resizes
  const clamp = useCallback((v) => {
    const vp = viewportRef.current;
    const tr = trackRef.current;
    if (!vp || !tr) return 0;
    const max = Math.max(0, tr.scrollWidth - vp.clientWidth);
    return Math.min(0, Math.max(-max, v));
  }, []);

  useEffect(() => { setOffset(o => clamp(o)); }, [cards?.length, clamp]);

  useEffect(() => {
    const onResize = () => setOffset(o => clamp(o));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  // Measure the actual rendered card width so CardThumb scales to match the
  // creator canvas exactly (snapshot render with scale transform).
  useEffect(() => {
    const item = trackRef.current?.querySelector('[data-card-item]');
    const vp = viewportRef.current;
    if (!item) return;
    const update = () => {
      const w = item.offsetWidth || (vp ? vp.clientWidth - 32 : 0) || 320;
      if (w > 0) setCardW(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(item);
    if (vp) ro.observe(vp);
    return () => ro.disconnect();
  }, [cards?.length]);

  if (!cards?.length) return null;

  const step = () => {
    const item = trackRef.current?.querySelector('[data-card-item]');
    return item ? item.offsetWidth + 12 : cardW + 12;
  };

  const snapToNearest = () => {
    setOffset(o => {
      const s = step();
      const idx = Math.round(-o / s);
      const count = cards.length;
      const clampedIdx = Math.max(0, Math.min(count - 1, idx));
      return clamp(-clampedIdx * s);
    });
  };

  const scrollByCard = (dir) => setOffset(o => clamp(o - dir * step()));

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setDragging(true);
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startOffset: offset, startTime: Date.now(), axis: null };
    try { viewportRef.current.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    const st = drag.current;
    if (!st || st.id !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (st.axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.axis === 'y') return; // vertical → let the page scroll (touch-action: pan-y)
    e.preventDefault();
    setOffset(clamp(st.startOffset + dx));
  };

  const onPointerUp = (e) => {
    const st = drag.current;
    if (!st || st.id !== e.pointerId) return;
    drag.current = null;
    try { viewportRef.current.releasePointerCapture(e.pointerId); } catch {}
    setDragging(false);
    if (st.axis === 'x') {
      // Swipe commit: >20% of card width OR velocity > 0.3px/ms advances one
      // card in the drag direction; otherwise snap back to the start card.
      const dx = e.clientX - st.startX;
      const elapsed = Math.max(1, Date.now() - st.startTime);
      const velocity = Math.abs(dx) / elapsed;
      const cw = step();
      if (Math.abs(dx) > cw * 0.2 || velocity > 0.3) {
        const dir = dx < 0 ? 1 : -1;
        setOffset(clamp(st.startOffset - dir * cw));
      } else {
        setOffset(clamp(st.startOffset));
      }
    } else if (st.axis === null) {
      // No movement at all → a tap (not a swipe). Fire scroll-to-story.
      const elapsed = Date.now() - st.startTime;
      if (elapsed < 300 && onTap) onTap();
    }
  };

  const onWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 8) {
      setOffset(o => clamp(o + e.deltaX));
    }
  };

  const stepSize = cardW + 12;
  const activeIndex = Math.max(0, Math.min(cards.length - 1, Math.round(-offset / stepSize)));

  return (
    <div className="relative group -mx-4 px-4 md:mx-0 md:px-0">
      <div
        ref={viewportRef}
        className="relative overflow-hidden pb-1 select-none"
        style={{ touchAction: 'pan-y', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {cards.length > 1 && (
          <div className="absolute top-2.5 left-2 right-2 flex gap-1 z-10 pointer-events-none">
            {cards.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                  boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                }}
              />
            ))}
          </div>
        )}
        <div
          ref={trackRef}
          className="flex gap-3"
          style={{ transform: `translate3d(${offset}px, 0, 0)`, willChange: 'transform', transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        >
          {cards.map((card) => (
            <div key={card.id} data-card-item className="flex-shrink-0" style={{ width: '100%' }}>
              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{ paddingTop: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
              >
                <div className="absolute inset-0">
                  <CardThumb card={card} displaySize={cardW} autoplay tokens={tokens} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop hover arrows */}
      {cards.length > 1 && (
        <>
          <button
            onClick={() => scrollByCard(-1)}
            aria-label="Previous card"
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <button
            onClick={() => scrollByCard(1)}
            aria-label="Next card"
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight size={18} className="text-gray-700" />
          </button>
        </>
      )}
    </div>
  );
}