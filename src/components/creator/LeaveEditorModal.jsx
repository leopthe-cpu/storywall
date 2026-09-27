export default function LeaveEditorModal({ onSaveChanges, onDiscard, onClose, isNewStory }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full bg-[#1A1A1A] rounded-t-3xl px-5 pt-6 pb-10 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-white font-semibold text-base text-center mb-1">
          {isNewStory ? 'Save or delete?' : 'Unsaved changes'}
        </h2>

        {isNewStory ? (
          <>
            <button
              onClick={onSaveChanges}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              Save draft
            </button>
            <button
              onClick={onDiscard}
              className="w-full py-3.5 rounded-2xl bg-white/10 text-white/80 font-semibold text-sm hover:bg-white/15 active:scale-[0.98] transition-all"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl text-white/50 font-medium text-sm hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onSaveChanges}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              Save changes
            </button>
            <button
              onClick={onDiscard}
              className="w-full py-3.5 rounded-2xl bg-white/10 text-white/80 font-semibold text-sm hover:bg-white/15 active:scale-[0.98] transition-all"
            >
              Discard changes
            </button>
          </>
        )}
      </div>
    </div>
  );
}