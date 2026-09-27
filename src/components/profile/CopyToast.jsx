import { AnimatePresence, motion } from 'framer-motion';

// Industry-standard "Link copied" confirmation: a small pill that fades in,
// auto-dismisses after ~2s, has no close button, and requires no user action.
export default function CopyToast({ show, message = 'Link copied' }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-black text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg pointer-events-none"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}