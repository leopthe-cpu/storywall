import { motion, AnimatePresence } from 'framer-motion';
import { FileEdit, RefreshCw } from 'lucide-react';

// Modal shown when the user taps Generate again after editing the raw notes.
// Offers two choices: re-structure only (keep images), or full regenerate.
export default function RegenerateChoice({ open, onClose, onEditsOnly, onFullRegenerate }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-6 pb-8 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Re-generate</h2>
            <p className="text-sm text-gray-500 mb-5 text-center">You edited your notes. How should we update the story?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { onClose(); onEditsOnly(); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileEdit size={20} className="text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Only run the edits</div>
                  <div className="text-sm text-gray-500">Re-structure the text into cards, keeping existing images & style</div>
                </div>
              </button>
              <button
                onClick={() => { onClose(); onFullRegenerate(); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <RefreshCw size={20} className="text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Generate a new story</div>
                  <div className="text-sm text-gray-500">Full pipeline — new text structure, new images, new style</div>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}