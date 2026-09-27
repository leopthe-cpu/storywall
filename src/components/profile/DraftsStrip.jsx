// Horizontal strip of draft cards shown on the profile page (owner only).
// Each draft shows a preview tile, title, and draft type (AI or manual).
// Tapping a draft opens it in the Story Creator.
export default function DraftsStrip({ drafts, onOpenDraft }) {
  if (!drafts || drafts.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Drafts</span>
        <span className="text-xs text-gray-300">{drafts.length}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {drafts.map(draft => (
          <button
            key={draft.id}
            onClick={() => onOpenDraft(draft)}
            className="flex-shrink-0 w-28 text-left active:scale-95 transition-transform"
          >
            <div className="w-28 h-28 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-1.5 overflow-hidden">
              {draft.ai_generated ? (
                <span className="text-2xl">✨</span>
              ) : (
                <span className="text-xs text-gray-300">Draft</span>
              )}
            </div>
            <div className="text-xs font-medium text-gray-700 truncate">
              {draft.title || 'Untitled'}
            </div>
            <div className="text-[10px] text-gray-400">
              {draft.ai_generated ? 'AI draft' : 'Draft'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}