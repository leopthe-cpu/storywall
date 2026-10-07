import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UsernameClaimField from '@/components/landing/UsernameClaimField';
import SwipeableCards from '@/components/landing/SwipeableCards';
import useDocumentTitle from '@/lib/useDocumentTitle';

// Cursor spotlight on the grid: the same grid in darker lines, revealed only inside
// a soft circle that follows the pointer. Tune the look here.
const SPOT_RADIUS = 'min(260px, 46vw)';      // size of the lit circle (smaller on narrow screens)
const SPOT_LINE = 'rgba(38,38,36,0.24)';      // line colour inside the circle (brand ink at 24%)
const SPOT_MASK = `radial-gradient(circle ${SPOT_RADIUS} at var(--mx, -999px) var(--my, -999px), #000 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)`;

// Public landing page — the StoryWall hero.
// Renders for all visitors (logged-in or not). Does NOT redirect to sign-in.
// Features a typewriter headline, swipeable card stack, and a username-claim
// field with live green/red availability feedback.
export default function Landing() {
  useDocumentTitle('storywall | stories > bullet points');
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [markLit, setMarkLit] = useState(false);

  const pre = "You're more than\n";
  const mark = "a job title.";
  const full = pre + mark;

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce) {
      setTyped(full);
      setMarkLit(true);
      return;
    }
    let i = 0;
    const tick = () => {
      i++;
      setTyped(full.slice(0, i));
      if (i < full.length) {
        setTimeout(tick, 45 + Math.random() * 40);
      } else {
        setMarkLit(true);
      }
    };
    const startTimer = setTimeout(tick, 350);
    return () => clearTimeout(startTimer);
  }, []);

  // Hand off to /signup with the chosen username in the query string. /signup
  // is the single place that decides what happens next — straight to OAuth
  // sign-up for a fresh visitor, or (if this browser already has a session)
  // an explicit "you're already signed in" confirmation rather than silently
  // reusing that session as if it were a new sign-up.
  const handleClaim = (username) => {
    navigate(`/signup?username=${encodeURIComponent(username)}`);
  };

  // Cursor spotlight: follow the pointer (mouse, or a finger while dragging) with a gentle glide.
  const spotRef = useRef(null);
  useEffect(() => {
    const el = spotRef.current;
    if (!el) return undefined;
    const ease = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0.2;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, lastX = 0, lastY = 0, seen = false;
    const tick = () => {
      cx += (tx - cx) * ease;
      cy += (ty - cy) * ease;
      el.style.setProperty('--mx', `${cx}px`);
      el.style.setProperty('--my', `${cy}px`);
      raf = Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4 ? requestAnimationFrame(tick) : 0;
    };
    const aim = () => {
      const r = el.getBoundingClientRect();     // the layer scrolls with the page, so aim relative to it
      tx = lastX - r.left;
      ty = lastY - r.top;
      if (!seen) { cx = tx; cy = ty; seen = true; }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e) => { lastX = e.clientX; lastY = e.clientY; el.style.opacity = '1'; aim(); };
    const onScroll = () => { if (seen) aim(); };    // keep the circle under a still cursor while scrolling
    const hide = () => { el.style.opacity = '0'; };
    const onUp = (e) => { if (e.pointerType !== 'mouse') hide(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', hide, { passive: true });
    document.documentElement.addEventListener('mouseleave', hide);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', hide);
      document.documentElement.removeEventListener('mouseleave', hide);
    };
  }, []);

  // Render the typed text with the highlight mark on "a job title."
  const renderTyped = () => {
    if (typed.length <= pre.length) {
      return typed.replace('\n', '<br/>');
    }
    const markPart = typed.slice(pre.length);
    return pre.replace('\n', '<br/>') + `<span class="landing-mark${markLit ? ' lit' : ''}">${markPart}</span>`;
  };
  // The finished headline, used invisibly to reserve its final height so
  // nothing below it (the card stack on mobile) moves while it types.
  const finalHeadline = pre.replace('\n', '<br/>') + `<span class="landing-mark">${mark}</span>`;
  const cursor = (
    <span
      className="inline-block w-[0.07em] h-[0.92em] bg-[#262624] ml-[0.06em]"
      style={{ animation: 'blink-cursor 1s step-end infinite', transform: 'translateY(0.1em)' }}
    />
  );

  return (
    <div
      style={{
        background: '#F4F2EC',
        backgroundImage: 'linear-gradient(#E6E0D2 1px, transparent 1px), linear-gradient(90deg, #E6E0D2 1px, transparent 1px)',
        backgroundSize: '38px 38px',
        backgroundPosition: 'center top',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* Grid fade overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(120% 100% at 50% 0%, transparent 0%, #F4F2EC 72%)',
        }}
      />

      {/* Cursor spotlight: darker grid lines, visible only inside a soft circle at the pointer */}
      <div
        ref={spotRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.5s ease',
          backgroundImage: `linear-gradient(${SPOT_LINE} 1px, transparent 1px), linear-gradient(90deg, ${SPOT_LINE} 1px, transparent 1px)`,
          backgroundSize: '38px 38px',
          backgroundPosition: 'center top',
          WebkitMaskImage: SPOT_MASK,
          maskImage: SPOT_MASK,
        }}
      />

      <div className="relative z-10 max-w-[1180px] mx-auto px-7 sm:px-7">
        {/* Header */}
        <header className="flex items-center justify-between pt-[26px]">
          <img src="/logo-slash-ink.png" alt="StoryWall" className="h-[18px] sm:h-[22px] w-auto flex-shrink-0" />
          <nav className="flex items-center gap-3 sm:gap-[22px] whitespace-nowrap">
            <Link to="/signin" className="font-mono text-[14px] font-bold text-[#6B6964] no-underline hover:text-[#262624]">Sign in</Link>
            <Link to="/signup" className="font-mono text-[12px] sm:text-[13px] font-bold text-[#F4F2EC] bg-[#262624] px-3 sm:px-4 py-2 rounded-lg no-underline hover:opacity-90 hover:-translate-y-px transition-all">Claim your wall</Link>
          </nav>
        </header>

        {/* Hero */}
        {/* Desktop: copy column left, card stack right (unchanged).
            Mobile: the copy column uses `contents`, so each piece becomes its
            own grid row and can be ordered around the stack:
            headline → cards → subcopy → claim field. */}
        <main className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-0 md:gap-16 items-center min-h-[calc(100vh-90px)] py-10 pb-16">
          {/* Copy */}
          <div className="contents md:block">
            {/* The invisible finished headline holds the final height; the
                typed text draws on top of it at the same width, so it wraps
                identically and the layout never shifts while typing. */}
            <h1
              className="order-1 md:order-none relative font-display font-medium leading-[1.04] tracking-[-0.01em] mb-6"
              style={{ fontSize: 'clamp(2.6rem, 6vw, 4.75rem)' }}
              aria-label={full.replace('\n', ' ')}
            >
              <span aria-hidden="true" className="invisible block">
                <span dangerouslySetInnerHTML={{ __html: finalHeadline }} />
                {cursor}
              </span>
              <span aria-hidden="true" className="absolute inset-x-0 top-0">
                <span dangerouslySetInnerHTML={{ __html: renderTyped() }} />
                {cursor}
              </span>
            </h1>
            {/* Mobile: one paragraph across the full width. Desktop keeps the
                two-line break inside the narrower column. */}
            <p className="order-3 md:order-none text-[clamp(1.02rem,1.5vw,1.18rem)] text-[#6B6964] md:max-w-[38ch] mb-6 md:mb-[34px]">
              The stories behind the bullet points.{' '}<br className="hidden md:inline" />
              All your projects, one simple link.
            </p>
            <div className="order-4 md:order-none">
              <UsernameClaimField onClaim={handleClaim} autoFocus />
              <p className="font-mono text-xs text-[#6B6964] mt-3.5">
                Best ones are still available!
              </p>
            </div>
          </div>

          {/* Card stack */}
          <div className="order-2 md:order-last">
            <SwipeableCards />
          </div>
        </main>
      </div>
    </div>
  );
}