import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Sparkles, Lock, FlaskConical } from '@/components/icons';

// Bottom sheet that appears when tapping the "+" button.
// Shows two options: Write (existing manual flow) and Generate (AI flow).
// Generate is locked for non-premium users with an upsell indicator.
// "Prompt Test" is admin-only — gated by the user's role field.
export default function WriteGenerateToggle({ open, onClose, onSelectWrite, onSelectGenerate, isPremium, isAdmin, onSelectPromptTest }) {
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
            <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">New story</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { onClose(); onSelectWrite(); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Pencil size={20} className="text-gray-700" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Write</div>
                  <div className="text-sm text-gray-500">Build your story card by card, manually</div>
                </div>
              </button>
              <button
                onClick={() => { if (isPremium) { onClose(); onSelectGenerate(); } }}
                disabled={!isPremium}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors text-left ${
                  isPremium
                    ? 'border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                    : 'border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                  {isPremium ? <Sparkles size={20} className="text-orange-600" /> : <Lock size={18} className="text-gray-400" />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Generate</div>
                  <div className="text-sm text-gray-500">
                    {isPremium ? 'Write your story as notes, AI builds the carousel' : 'Premium feature — upgrade to unlock'}
                  </div>
                </div>
                {isPremium && <Sparkles size={16} className="text-orange-400" />}
              </button>
              {isAdmin && (
                <button
                  onClick={() => { onClose(); onSelectPromptTest(); }}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FlaskConical size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Prompt Test</div>
                    <div className="text-sm text-gray-500">Test image prompts directly</div>
                  </div>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}