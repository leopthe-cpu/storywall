import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import PixelSpinner from '@/components/ui/PixelSpinner';

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
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 left-5 text-gray-400 hover:text-gray-900 transition-colors"
      >
        <ChevronLeft size={22} />
      </button>
      <div className="flex flex-col items-center gap-4">
        <PixelSpinner size={24} color="#111827" />
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{pct}%</div>
        <div className="text-sm font-medium text-gray-600">
          Matching your story to skill tags…
        </div>
      </div>
    </motion.div>
  );
}