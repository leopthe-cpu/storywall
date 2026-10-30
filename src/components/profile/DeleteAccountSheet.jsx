import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from '@/components/icons';
import { deleteMyAccount, signOut } from '@/api/storywallApi';
import BusyLabel from '@/components/ui/BusyLabel';

// "Delete my account" confirmation (Settings → Account). Deleting can't be
// undone, so the user types their username back (the server checks it too)
// and is offered "Download my data" first.
export default function DeleteAccountSheet({ username, onClose, onDownload }) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const expected = username || 'delete';
  const matches = typed.trim().replace(/^@/, '').toLowerCase() === expected.toLowerCase();

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteMyAccount(typed.trim());
      // The account is gone: drop the local session and leave.
      await signOut().catch(() => {});
      window.location.assign('/');
    } catch (e) {
      console.error('[DeleteAccountSheet] delete failed:', e);
      setError(e?.status === 403
        ? 'Admin accounts can’t be deleted here.'
        : 'Couldn’t delete your account. Nothing was removed. Check your connection and try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40"
        onClick={deleting ? undefined : onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-8 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="delete-account-title" className="text-base font-semibold text-gray-900">Delete your account?</h2>
          <button onClick={onClose} disabled={deleting} aria-label="Close" className="text-gray-400 hover:text-gray-700 disabled:opacity-40">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          This permanently deletes your wall, every story and draft, your pictures and videos, and your sign-in.
          It can’t be undone.
        </p>
        <button onClick={onDownload} disabled={deleting} className="text-sm font-medium text-gray-900 underline mt-3 disabled:opacity-40">
          Download my data first
        </button>
        <label className="block mt-4">
          <span className="text-xs text-gray-500">
            Type <span className="font-semibold text-gray-900">{expected}</span> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={deleting}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </label>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button
          onClick={handleDelete}
          disabled={!matches || deleting}
          aria-busy={deleting}
          className="mt-4 w-full rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          <BusyLabel busy={deleting} label="Deleting…">Delete my account</BusyLabel>
        </button>
      </motion.div>
    </div>
  );
}
