import { motion, AnimatePresence } from 'framer-motion';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Progress overlay shown while the AI generation pipeline runs.
// Shows a percentage indicator based on completed_steps / total_steps.
export default function GenerateProgress({ visible, completedSteps, totalSteps, currentStep }) {
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-xs px-8 flex flex-col items-center gap-6">
            <PixelSpinner size={24} color="#111827" />

            {/* Percentage */}
            <div className="text-3xl font-bold text-gray-900 tabular-nums">{pct}%</div>

            {/* Current step label */}
            <div className="text-sm text-gray-500 text-center min-h-[20px]">
              {currentStep || 'Working...'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}