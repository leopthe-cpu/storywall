import { AnimatePresence } from 'framer-motion';
import StoryLoadingScreen, { SHARED_LINES, stepCeiling } from '@/components/creator/StoryLoadingScreen';

// Progress overlay shown while a Generate run goes. The steps come from the
// job (src/lib/generateJob.js progressOf): writing the cards (1 step), then
// one step per picture, then assembling (all steps done). The number of
// pictures is only known once writing finishes, so the steps can't simply
// be counted from the start; each phase gets a fixed range instead:
//   writing 0–45%, pictures 50–95%, assembling 97% (the screen closes when
//   the story is on the cards).
// Writing takes the longest, hence its slow tau: the number keeps creeping
// instead of reaching its hold point early and stopping.
function ceilingOf(completed, total) {
  if (total > 0 && completed >= total) return { ceiling: 97, tau: 600 };
  if (completed === 0) return { ceiling: 45, tau: 9000 };
  return { ceiling: stepCeiling(completed - 1, total - 1, 50, 95), tau: 3000 };
}

export default function GenerateProgress({ visible, completedSteps, totalSteps }) {
  const { ceiling, tau } = ceilingOf(completedSteps, totalSteps);
  return (
    <AnimatePresence>
      {visible && <StoryLoadingScreen ceiling={ceiling} tau={tau} lines={SHARED_LINES} />}
    </AnimatePresence>
  );
}
