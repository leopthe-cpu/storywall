// Confirmation dialog shown when applying a template or draft to a story
// that has unsaved edits. Offers three options: save the current edits as
// a draft before replacing, discard the edits and replace, or cancel.
export default function TemplateConfirmModal({ itemLabel, onSaveDraft, onReplace, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl p-6 max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 mb-2">Replace this story?</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You have unsaved edits. Replace with {itemLabel}? Your current edits can be saved as a draft first.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSaveDraft}
            className="w-full py-3 rounded-xl bg-black text-white font-medium text-sm hover:bg-gray-900 transition-colors"
          >
            Save as draft &amp; Replace
          </button>
          <button
            onClick={onReplace}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Replace (discard edits)
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}