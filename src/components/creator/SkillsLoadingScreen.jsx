import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PixelSpinner from '@/components/ui/PixelSpinner';
import GridBackdrop, { GRID_BASE } from '@/components/ui/GridBackdrop';
import BackButton from '@/components/ui/BackButton';

// Loading screen shown between the Story Builder and the Publish screen
// while skills are being generated. Visually similar to GenerateProgress.
// There's no real step signal for this single async call, so the percentage
// is simulated: it eases toward ~92% and holds there until the real result
// arrives and this screen unmounts (phase flips to 'ready' in PostFlowSheet).
export default function SkillsLoadingScreen({ onClose }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const next = Math.min(92, Math.round(92 * (1 - Math.exp(-elapsed / 1400))));
      setPct(next);
      if (next < 92) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Grid at full strength everywhere — the only fade is the disc. */}
      <GridBackdrop fade={false} />
      <BackButton onClick={onClose} className="absolute top-4 left-5" />
      {/* The progress sits on a disc of the page colour that hides the grid
          behind the text and fades out at its edge, so the numbers stay
          legible over the lines. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{ width: 440, height: 440, background: `radial-gradient(circle, ${GRID_BASE} 0%, ${GRID_BASE} 42%, rgba(244,242,236,0) 70%)` }}
      />
      <div className="relative flex flex-col items-center gap-4">
        <PixelSpinner size={24} />
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{pct}%</div>
        <div className="text-sm font-medium text-gray-600">
          Matching your story to skill tags…
        </div>
      </div>
    </motion.div>
  );
}