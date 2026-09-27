import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

// Fallback for the share button when the Clipboard API is unavailable or denied.
// Shows the URL in a readable field the user can select/copy manually, plus a
// copy button that retries the Clipboard API.
export default function ShareUrlModal({ url, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // leave it to manual selection
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-[90%] max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Copy link</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={url}
            readOnly
            onFocus={e => e.target.select()}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none min-w-0"
          />
          <button
            onClick={copy}
            className="px-4 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Tap copy or select the text to copy manually.</p>
      </div>
    </div>
  );
}