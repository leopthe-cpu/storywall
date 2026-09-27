export default function DeleteStoryModal({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-gray-900 font-semibold text-base">Delete this story?</h3>
        <p className="text-gray-500 text-sm mt-1">This cannot be undone.</p>
        {title && <p className="text-gray-400 text-xs mt-2 truncate">“{title}”</p>}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}