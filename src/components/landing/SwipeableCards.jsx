import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// Landing hero card stack — auto-cycling "deal to back".
//
// Every cycle the front card slips under and to the back of the stack while
// the card behind it glides up to the front. Resting poses are the original
// static stack's values (rotate 2.5° front; -4°/-15,7/0.97 middle; -8°/-30,14/
// 0.94 back, at 0.8 / 0.55 opacity), so a still frame looks exactly like the
// stack did before it was animated.
//
// Loop: hold HOLD_MS → swap (SWAP_MS, all cards at once) → hold → … Paused
// while the tab is hidden or the hero is off-screen (resumes with a fresh
// hold). With prefers-reduced-motion the stack stays still.

const HOLD_MS = 1500;
const SWAP_S = 0.65;
const STAGGER_S = 0.035; // ripple for cards that just move up one slot
// Expo-out: ~70% of the distance in the first ~150ms, then a long soft
// settle with no overshoot.
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const VISIBLE_SLOTS = 3;

// The original CSS was `rotate(r) translate(tx, ty) scale(s)` — translation
// happens in the ROTATED frame. Every pose here is written as
// `translate() rotate() scale()` (same function list in every slot, so CSS
// interpolates it cleanly), so convert the offset into screen space to land
// on exactly the same pixels: rotate(r) translate(t) === translate(R(r)·t) rotate(r).
function pose({ rotate, tx = 0, ty = 0, scale = 1, opacity, filter }) {
  const rad = (rotate * Math.PI) / 180;
  return {
    x: tx * Math.cos(rad) - ty * Math.sin(rad),
    y: tx * Math.sin(rad) + ty * Math.cos(rad),
    rotate,
    scale,
    opacity,
    filter,
  };
}

// Slot poses, front → back. Background stays #262624/#2A2724 as before; the
// lighter greys of the back cards come from their opacity over the page.
const SLOTS = [
  { ...pose({ rotate: 2.5, opacity: 1, filter: 'saturate(1)' }), bg: '#262624' },
  { ...pose({ rotate: -4, tx: -15, ty: 7, scale: 0.97, opacity: 0.8, filter: 'saturate(1)' }), bg: '#2A2724' },
  { ...pose({ rotate: -8, tx: -30, ty: 14, scale: 0.94, opacity: 0.55, filter: 'saturate(0.8)' }), bg: '#262624' },
];
// Cards beyond the visible slots wait, invisible, exactly behind the back card.
const HIDDEN = { ...SLOTS[VISIBLE_SLOTS - 1], opacity: 0 };

// Placeholder stories — replace with real ones any time.
const CARDS = [
  { tag: 'Product Design', eyebrow: 'Chapter 03 · The turning point', title: 'Rebuilt onboarding and cut drop-off in half', step: 1 },
  { tag: 'Growth', eyebrow: 'Chapter 02 · The drift', title: 'Sent fewer emails and booked twice as many meetings', step: 2 },
  { tag: 'Data', eyebrow: 'Chapter 04 · The signal', title: 'Let one thumbs-up beat years of viewing logs', step: 3 },
  { tag: 'Engineering', eyebrow: 'Chapter 01 · The bottleneck', title: 'Cut checkout load time from 11 seconds to 2', step: 0 },
];

const SHADOW = '0 24px 60px -20px rgba(17,17,17,0.4), 0 4px 12px rgba(17,17,17,0.1)';

function CardFace({ card }) {
  return (
    <>
      {/* Media area */}
      <div
        className="h-[56%] relative flex items-end p-[18px]"
        style={{
          background: 'radial-gradient(140% 120% at 20% 10%, #3a3532 0%, transparent 55%), linear-gradient(135deg, #1b1917 0%, #2f2b28 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            mixBlendMode: 'overlay',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.4px)',
            backgroundSize: '14px 14px',
          }}
        />
        <span className="relative font-mono text-[10.5px] font-bold tracking-[0.08em] uppercase bg-white/15 backdrop-blur-sm border border-white/20 text-white px-2.5 py-1.5 rounded-full">
          {card.tag}
        </span>
      </div>
      {/* Body */}
      <div className="flex-1 pt-5 px-5">
        <p className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-white/50 mb-2">
          {card.eyebrow}
        </p>
        <h2 className="font-mono font-bold text-[19px] leading-[1.22] tracking-[-0.01em]">
          {card.title}
        </h2>
      </div>
      {/* Footer with page dots */}
      <div className="flex items-center gap-[7px] px-5 pt-4 pb-[18px] mt-auto">
        {[0, 1, 2, 3].map((i) => (
          i === card.step
            ? <span key={i} className="w-5 h-1.5 rounded-[3px] bg-white" />
            : <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/28" />
        ))}
      </div>
    </>
  );
}

export default function SwipeableCards() {
  const n = CARDS.length;
  const reduceMotion = useReducedMotion();
  // order[slot] = card index. Swapping rotates it: order.push(order.shift()).
  const [order, setOrder] = useState(() => CARDS.map((_, i) => i));
  const orderRef = useRef(order);
  orderRef.current = order;
  // During a swap: which card just left the front (it goes under everything)
  // and which one is arriving (it goes over everything).
  const [swap, setSwap] = useState(null); // { outgoing, incoming } | null
  const rootRef = useRef(null);

  useEffect(() => {
    if (reduceMotion || n < 2) return undefined;
    let timer = null;
    let running = false;
    let tabVisible = document.visibilityState !== 'hidden';
    let onScreen = true;

    const clear = () => { clearTimeout(timer); timer = null; };
    const hold = () => { timer = setTimeout(runSwap, HOLD_MS); };
    const runSwap = () => {
      const prev = orderRef.current;
      const next = prev.slice();
      next.push(next.shift());
      setSwap({ outgoing: prev[0], incoming: prev[1] });
      setOrder(next);
      // Settle: the longest move is SWAP_S plus the deepest stagger.
      timer = setTimeout(() => { setSwap(null); hold(); }, (SWAP_S + STAGGER_S * VISIBLE_SLOTS) * 1000);
    };
    const update = () => {
      const shouldRun = tabVisible && onScreen;
      if (shouldRun && !running) { running = true; hold(); }
      if (!shouldRun && running) { running = false; clear(); setSwap(null); }
    };

    const onVisibility = () => { tabVisible = document.visibilityState !== 'hidden'; update(); };
    document.addEventListener('visibilitychange', onVisibility);
    let io = null;
    if (rootRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
      io.observe(rootRef.current);
    }
    update();

    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
    };
  }, [reduceMotion, n]);

  return (
    <div ref={rootRef} className="relative flex justify-center items-center min-h-[440px]">
      <div className="relative w-[300px] h-[400px]">
        {CARDS.map((card, i) => {
          const slot = order.indexOf(i);
          const isOutgoing = swap?.outgoing === i;
          const isIncoming = swap?.incoming === i;

          // The outgoing card stays visible while it travels to the back
          // pose, even if its new slot is a hidden one; at the end of the
          // swap it vanishes in the same frame the next card appears in that
          // identical back pose, so the hand-off can't be seen.
          let target;
          if (slot < VISIBLE_SLOTS) target = SLOTS[slot];
          else if (isOutgoing) target = SLOTS[VISIBLE_SLOTS - 1];
          else target = HIDDEN;
          // The card stepping into the back slot from hiding waits invisible
          // until the outgoing card has landed (see above).
          const appearingFromHidden = swap && !isOutgoing && slot === VISIBLE_SLOTS - 1 && n > VISIBLE_SLOTS;
          if (appearingFromHidden) target = HIDDEN;

          // CSS transitions, not Framer Motion: Framer's accelerated opacity
          // tween painted one frame at full opacity when it finished, which
          // flashed the back card (and the outgoing text) once per cycle.
          // Outside a swap there is no transition, so the end-of-swap hand-off
          // happens within a single frame.
          const delay = swap && !isOutgoing && !isIncoming ? STAGGER_S * slot : 0;
          const move = swap
            ? ['transform', 'opacity', 'filter', 'background-color']
              .map((prop) => `${prop} ${SWAP_S * 1000}ms ${EASE} ${Math.round(delay * 1000)}ms`).join(', ')
            : 'none';

          // Outgoing goes under everything at t=0, incoming over everything,
          // so the new front card slides OVER the old one.
          const zIndex = isOutgoing ? 0 : isIncoming ? n + 2 : n + 1 - slot;

          const front = slot === 0;
          // Content fades on its own, shorter timings (see the move above
          // for why this is CSS rather than Framer Motion).
          const contentTransition = isIncoming
            ? 'opacity 250ms ease-out 100ms'
            : isOutgoing
              ? 'opacity 150ms ease-out'
              : 'none';

          return (
            <article
              key={i}
              aria-hidden={!front}
              className="absolute inset-0 rounded-[20px] overflow-hidden text-white flex flex-col"
              style={{
                transform: `translate(${target.x}px, ${target.y}px) rotate(${target.rotate}deg) scale(${target.scale})`,
                opacity: target.opacity,
                filter: target.filter,
                backgroundColor: target.bg,
                transition: move,
                zIndex,
                boxShadow: SHADOW,
                willChange: 'transform, opacity',
                transformOrigin: '50% 50%',
              }}
            >
              <div
                className="flex flex-col h-full"
                style={{ opacity: front ? 1 : 0, transition: contentTransition }}
              >
                <CardFace card={card} />
              </div>
            </article>
          );
        })}
        {/* Swipe note — stays put, above the stack */}
        <div
          className="absolute -bottom-1.5 -right-1.5 font-mono text-[11px] text-[#6B6964] bg-[#F4F2EC] border border-[#E6E0D2] px-3 py-1.5 rounded-full flex items-center gap-[7px]"
          style={{ boxShadow: '0 6px 18px -8px rgba(17,17,17,0.25)', zIndex: n + 10 }}
        >
          <span>swipe the story</span>
          <span style={{ animation: 'nudge-arrow 1.6s ease-in-out infinite' }}>→</span>
        </div>
      </div>
    </div>
  );
}
