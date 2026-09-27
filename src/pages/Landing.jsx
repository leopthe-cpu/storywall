import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UsernameClaimField from '@/components/landing/UsernameClaimField';
import SwipeableCards from '@/components/landing/SwipeableCards';

// Public landing page — the StoryWall hero.
// Renders for all visitors (logged-in or not). Does NOT redirect to sign-in.
// Features a typewriter headline, swipeable card stack, and a username-claim
// field with live green/red availability feedback.
export default function Landing() {
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

  // Render the typed text with the highlight mark on "a job title."
  const renderTyped = () => {
    if (typed.length <= pre.length) {
      return typed.replace('\n', '<br/>');
    }
    const markPart = typed.slice(pre.length);
    return pre.replace('\n', '<br/>') + `<span class="landing-mark${markLit ? ' lit' : ''}">${markPart}</span>`;
  };

  return (
    <div
      style={{
        background: '#FBFAF8',
        backgroundImage: 'linear-gradient(#E4E1DB 1px, transparent 1px), linear-gradient(90deg, #E4E1DB 1px, transparent 1px)',
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
          background: 'radial-gradient(120% 100% at 50% 0%, transparent 0%, #FBFAF8 72%)',
        }}
      />

      <div className="relative z-10 max-w-[1180px] mx-auto px-7 sm:px-7">
        {/* Header */}
        <header className="flex items-center justify-between pt-[26px]">
          <img src="/logo-grey.png" alt="StoryWall" className="h-[22px] w-auto" />
          <nav className="flex items-center gap-[22px]">
            <Link to="/signin" className="font-mono text-[13px] text-[#6B6864] no-underline hover:text-[#111]">Sign in</Link>
            <Link to="/signup" className="font-mono text-[13px] font-bold text-[#FBFAF8] bg-[#111] px-4 py-2 rounded-lg no-underline hover:opacity-90 hover:-translate-y-px transition-all">Get started</Link>
          </nav>
        </header>

        {/* Hero */}
        <main className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-4 md:gap-16 items-center min-h-[calc(100vh-90px)] py-10 pb-16">
          {/* Copy */}
          <div>
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.14em] uppercase text-[#6B6864] mb-6">
              <span
                className="w-[7px] h-[7px] rounded-full bg-[#111]"
                style={{ animation: 'pulse-dot 2.4s ease-in-out infinite' }}
              />
              A social career platform
            </span>
            <h1
              className="font-mono font-bold leading-[1.04] tracking-[-0.02em] mb-6"
              style={{ fontSize: 'clamp(2.5rem, 5.4vw, 4.15rem)' }}
            >
              <span dangerouslySetInnerHTML={{ __html: renderTyped() }} />
              <span
                className="inline-block w-[0.56ch] h-[1em] bg-[#111] ml-[0.05em]"
                style={{ animation: 'blink-cursor 1s step-end infinite', transform: 'translateY(0.12em)' }}
              />
            </h1>
            <p className="text-[clamp(1.02rem,1.5vw,1.18rem)] text-[#6B6864] max-w-[38ch] mb-[34px]">
              Your résumé lists what you did. StoryWall shows how — the projects, turning points, and craft behind the title, as swipeable stories on one shareable profile.
            </p>
            <UsernameClaimField onClaim={handleClaim} autoFocus />
            <p className="font-mono text-xs text-[#6B6864] mt-3.5">
              Free to start · Sign up with your email
            </p>
          </div>

          {/* Card stack */}
          <div className="order-first md:order-last">
            <SwipeableCards />
          </div>
        </main>
      </div>
    </div>
  );
}