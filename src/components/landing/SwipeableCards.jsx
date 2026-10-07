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

// Slot poses, front → back (positions/angles/scales are the original stack's).
// Back cards show their real image; BACK_LOOK picks how they recede.
// Filters use the same function list in every slot so they interpolate.
const BACK_LOOK = 'solid';
const LOOKS = {
  // Original fades: the page shows through the back cards.
  faded: [
    { opacity: 1, filter: 'brightness(1) saturate(1)' },
    { opacity: 0.8, filter: 'brightness(1) saturate(1)' },
    { opacity: 0.55, filter: 'brightness(1) saturate(0.8)' },
  ],
  // Fully opaque, dimmed with depth.
  solid: [
    { opacity: 1, filter: 'brightness(1) saturate(1)' },
    { opacity: 1, filter: 'brightness(0.82) saturate(0.9)' },
    { opacity: 1, filter: 'brightness(0.65) saturate(0.8)' },
  ],
};
const SLOTS = [
  { ...pose({ rotate: 2.5, ...LOOKS[BACK_LOOK][0] }), bg: '#262624' },
  { ...pose({ rotate: -4, tx: -15, ty: 7, scale: 0.97, ...LOOKS[BACK_LOOK][1] }), bg: '#2A2724' },
  { ...pose({ rotate: -8, tx: -30, ty: 14, scale: 0.94, ...LOOKS[BACK_LOOK][2] }), bg: '#262624' },
];
// Cards beyond the visible slots wait, invisible, exactly behind the back card.
const HIDDEN = { ...SLOTS[VISIBLE_SLOTS - 1], opacity: 0 };

// Real story cards (exported from StoryWall), in Oz's chosen order.
// Stored as 720px WebP in public/landing-cards/ (from 1080px PNGs: ~390 KB
// total instead of ~11 MB) — enough for sharp 2–3× screens at this size.
// Alt text is the card's own words so the stories stay readable to screen
// readers.
const CARDS = [
  { src: '/landing-cards/01.webp', alt: 'Unlocking customer insights' },
  { src: '/landing-cards/02.webp', alt: 'We had years of viewing data and a ranking algorithm built on top of it. Then we added a simple thumbs up. It took one tap and gave us something the logs couldn\'t: a direct opinion. Whenever the data and the opinion disagreed, we let the opinion win.' },
  { src: '/landing-cards/03.webp', alt: 'The 11s Bottleneck' },
  { src: '/landing-cards/04.webp', alt: 'Everyone had a theory, but the data showed something simple: our checkout took eleven seconds to load. A single third-party script was hogging six of them. We cut it, and load times dropped to two seconds overnight.' },
  { src: '/landing-cards/05.webp', alt: 'Less Volume, More Signal' },
  { src: '/landing-cards/06.webp', alt: 'I stopped blasting hundreds of cold templates a week. I sent fewer emails and booked twice as many meetings.' },
  { src: '/landing-cards/07.webp', alt: 'The Wrong Churn' },
  { src: '/landing-cards/08.webp', alt: 'Customers weren\'t canceling over price. The data pointed to something else entirely.' },
  { src: '/landing-cards/09.webp', alt: 'The 2 Week Drift' },
  { src: '/landing-cards/10.webp', alt: 'Users open the app for one reason: the market. So we pushed identity checks to the exact moment someone actually tried to trade. Until then, anyone could watch prices, build a watchlist, and set alerts.' },
];

const SHADOW = '0 24px 60px -20px rgba(17,17,17,0.4), 0 4px 12px rgba(17,17,17,0.1)';

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
  // Load an image only once its card is within one step of being visible
  // (front, the two back slots, or next in line). The first four load up
  // front; each later card loads three swaps before it reaches the front.
  // Once requested it stays loaded.
  const loadedRef = useRef(new Set());
  order.slice(0, VISIBLE_SLOTS + 1).forEach((i) => loadedRef.current.add(i));

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
    <div ref={rootRef} className="relative flex justify-center items-center min-h-[360px]">
      {/* Square cards to match the exported 1:1 story cards. */}
      <div className="relative w-[300px] h-[300px]">
        {CARDS.map((card, i) => {
          const slot = order.indexOf(i);
          const isOutgoing = swap?.outgoing === i;
          const isIncoming = swap?.incoming === i;

          // Back cards show their real image, so a card can't be silently
          // swapped for another at the back. With more cards than visible
          // slots, the outgoing card fades out as it slips under to the back
          // pose (it's going to a hidden slot) while the next card fades in
          // at the back slot — both on the same curve as the movement.
          const target = slot < VISIBLE_SLOTS ? SLOTS[slot] : HIDDEN;

          // CSS transitions, not Framer Motion: Framer's accelerated opacity
          // tween painted one frame at full opacity when it finished, which
          // flashed a card once per cycle.
          const delay = swap && !isOutgoing && !isIncoming ? STAGGER_S * slot : 0;
          const move = swap
            ? ['transform', 'opacity', 'filter', 'background-color']
              .map((prop) => `${prop} ${SWAP_S * 1000}ms ${EASE} ${Math.round(delay * 1000)}ms`).join(', ')
            : 'none';

          // Outgoing goes under everything at t=0, incoming over everything,
          // so the new front card slides OVER the old one.
          const zIndex = isOutgoing ? 0 : isIncoming ? n + 2 : n + 1 - slot;

          const front = slot === 0;

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
              >
                {loadedRef.current.has(i) && (
                  <img
                    src={card.src}
                    alt={card.alt}
                    width={720}
                    height={720}
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover select-none"
                  />
                )}
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
