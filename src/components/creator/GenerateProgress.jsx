import { AnimatePresence, motion } from 'framer-motion';
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

// "Sit back" card (roadmap A, Oz 2026-10-16), styled like the floating bar
// on the "already signed in" screen. Only shown when onLeave is set: the run
// is a server job, so leaving is safe and the story waits in Drafts (the
// "ready" toast also tells the user when it's done).
function SitBackCard({ onLeave }) {
  return (
    <motion.div
      className="w-full max-w-sm bg-[#FAF9F5]/95 backdrop-blur rounded-2xl p-4 shadow-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    >
      <p className="text-[15px] font-semibold text-[#262624]">Sit back, we&apos;ll finish this for you.</p>
      <p className="text-sm text-[#6B6964] mt-1">You can leave: your story will be waiting in Drafts in the builder.</p>
      <button
        type="button"
        onClick={onLeave}
        className="mt-3 w-full h-11 rounded-xl bg-[#262624] text-[#F4F2EC] text-sm font-semibold active:scale-[0.98] transition-all"
      >
        Go to my wall
      </button>
    </motion.div>
  );
}

export default function GenerateProgress({ visible, completedSteps, totalSteps, onLeave }) {
  const { ceiling, tau } = ceilingOf(completedSteps, totalSteps);
  return (
    <AnimatePresence>
      {visible && (
        <StoryLoadingScreen
          ceiling={ceiling}
          tau={tau}
          lines={SHARED_LINES}
          footer={onLeave ? <SitBackCard onLeave={onLeave} /> : null}
        />
      )}
    </AnimatePresence>
  );
}
