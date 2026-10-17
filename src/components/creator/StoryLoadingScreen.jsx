import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PixelSpinner from '@/components/ui/PixelSpinner';
import GridBackdrop from '@/components/ui/GridBackdrop';
import BackButton from '@/components/ui/BackButton';

// The one loading screen for Generate and skill tagging (roadmap A, Oz
// 2026-10-16): drifting paper grid, the percentage in the pixel font, and a
// rotating line in the style of The Sims loading screens. GenerateProgress
// and SkillsLoadingScreen are thin wrappers that pass their steps and lines.
//
// Smooth progress: the shown number eases towards a ceiling just below the
// next real step and waits there until that step really finishes, so it
// moves often instead of sitting at 0% and then jumping.

// Shared by both screens.
export const SHARED_LINES = [
  'Finding your hook…',
  'Cutting the boring part (there wasn’t one)…',
  'Putting your best sentence first…',
  'Counting the ‘we’s and the ‘I’s…',
  'Making the numbers look like numbers…',
  'Choosing a font your future boss will like…',
  'Lining things up to the pixel…',
  'Leaving room to breathe…',
  'Asking the cards to stand up straight…',
  'Turning notes into a story…',
  'Hiding the typos you didn’t make…',
  'Saving a seat for your photos…',
  'Making you look good. Easy job.',
];

export const SKILLS_LINES = [
  'Reading between your lines…',
  'Spotting what you’re good at…',
  'Matching your story to skill tags…',
  'Turning what you did into what you know…',
];

const LINE_MS = 3200;
// Eases the shown percentage towards `ceiling` (0–100). Callers set the
// ceiling just below the next real step (see stepCeiling), so the number
// waits there until that step really finishes. `tau` is how fast it gets
// close (ms); a step that takes long wants a bigger tau so the number keeps
// creeping instead of reaching the ceiling early and stopping.
export function useEasedProgress(ceiling, tau = 1400) {
  const [pct, setPct] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = now - last;
      last = now;
      const v = valueRef.current;
      // Never goes backwards.
      const next = v >= ceiling ? v : v + (ceiling - v) * (1 - Math.exp(-dt / tau));
      valueRef.current = next;
      setPct(Math.floor(next + 0.001));
      if (ceiling - next > 0.05) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ceiling, tau]);

  return pct;
}

// Ceiling for step `done` of `count` inside the range from..to: 90% of the
// way into the current step, i.e. just below the next one.
export function stepCeiling(done, count, from, to) {
  if (count <= 0) return from;
  return from + (to - from) * Math.min(1, (done + 0.9) / count);
}

// Starts on a random line so repeat visits don't always open the same way.
function useRotatingLine(lines) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * lines.length));
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % lines.length), LINE_MS);
    return () => clearInterval(t);
  }, [lines.length]);
  return lines[index % lines.length];
}

export default function StoryLoadingScreen({ ceiling, tau, lines, onBack, children }) {
  const pct = useEasedProgress(ceiling, tau);
  const line = useRotatingLine(lines);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Grid at full strength everywhere; the only fade is the disc. */}
      <GridBackdrop fade={false} drift />
      {onBack && <BackButton onClick={onBack} className="absolute top-4 left-5" />}
      {/* The progress sits on a disc of the page colour (82% opaque, so the
          grid still shows faintly through it) that fades out at its edge,
          keeping the numbers legible over the lines. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{ width: 440, height: 440, background: 'radial-gradient(circle, rgba(244,242,236,0.82) 0%, rgba(244,242,236,0.82) 42%, rgba(244,242,236,0) 70%)' }}
      />
      <div className="relative flex flex-col items-center gap-4 px-6">
        <PixelSpinner size={24} />
        <div className="font-pixel text-5xl text-gray-900 tabular-nums leading-none">{pct}%</div>
        {/* Fixed height so the lines changing don't move anything. */}
        <div className="h-5 flex items-center justify-center text-center" aria-hidden="true">
          <AnimatePresence mode="wait">
            <motion.div
              key={line}
              className="text-sm font-medium text-gray-600"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {line}
            </motion.div>
          </AnimatePresence>
        </div>
        {children}
      </div>
    </motion.div>
  );
}
