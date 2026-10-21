import { useState, useEffect } from 'react';
import { X, LogOut, Archive, Download } from '@/components/icons';
import { getMe, signOut, filterPosts, updateMe } from '@/api/storywallApi';
import { motion } from 'framer-motion';
import { ENABLE_DARK_MODE } from '@/lib/featureFlags';
import EditableUsername from '@/components/profile/EditableUsername';
import ArchivesModal from '@/components/profile/ArchivesModal';
import BusyLabel from '@/components/ui/BusyLabel';
import { downloadMyData } from '@/lib/dataExport';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';

export default function BurgerMenu({ user, onClose, onArchivesChanged }) {
  const [currentUser, setCurrentUser] = useState(null);
  // null until the saved setting has loaded: the switch shows neither state
  // and ignores taps, so it never flashes "public" or flips the wrong way.
  const [isPrivate, setIsPrivate] = useState(null);
  const [showArchives, setShowArchives] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);

  // Fetch the full current user (including email) from auth — the `user` prop
  // comes from getPublicProfile which intentionally omits email and role.
  useEffect(() => {
    getMe().then(u => {
      setCurrentUser(u);
      setIsPrivate(!!u?.is_private);
      if (u?.id) {
        filterPosts({ author_id: u.id, status: 'archived' }, '-updated_at', 50)
          .then(res => setArchivedCount(res.length))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const [showDelete, setShowDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const handleDownloadData = async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadMyData();
    } catch (e) {
      console.error('[BurgerMenu] data export failed:', e);
      setExportError("Couldn't prepare your data. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (isPrivate === null) return;
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    try {
      await updateMe({ is_private: newValue });
    } catch {
      setIsPrivate(!newValue);
    }
  };

  // Like Base44's logout('/'): end the session, then a full load of the home page.
  const handleLogout = async () => {
    await signOut().catch((e) => console.error('Sign-out failed', e));
    window.location.assign('/');
  };

  // Email: show the real email if available. If genuinely absent (e.g. Apple
  // hides it), show a provider-based fallback instead of a dash.
  const provider = currentUser?.provider || currentUser?.auth_provider;
  const emailDisplay = currentUser?.email
    || (provider === 'apple' ? 'Provided by Apple'
      : provider === 'google' ? 'Provided by Google'
      : 'Not available');

  return (
    <div className="fixed inset-0 z-50 flex">
      {!showArchives && (
        <>
      {/* Backdrop — fades with the panel. It used to be a plain div that
          stayed fully dark until the panel's spring finished settling (a
          second or more after closing), while the panel's emptied slot next
          to it showed the page undimmed: a bright rectangle on a dark page.
          It now covers the whole screen and fades out as the panel leaves. */}
      <motion.div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
        transition={{ duration: 0.2 }}
      />

      {/* Slide-in panel from right: spring in, short ease out (a spring's
          long settle kept the menu mounted after it looked closed). */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="absolute right-0 top-0 w-72 bg-white h-full flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Account */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account</p>
            <div className="space-y-3">
              <EditableUsername
                currentUsername={user?.username}
                currentUserId={user?.id}
                onSaved={onClose}
              />
              <InfoRow label="Email" value={emailDisplay} note="Managed by your sign-in provider" />
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Content</p>
            <button
              onClick={() => setShowArchives(true)}
              className="w-full flex items-center justify-between py-2 group"
            >
              <div className="flex items-center gap-2.5">
                <Archive size={16} className="text-gray-400 group-hover:text-gray-600" />
                <p className="text-sm font-medium text-gray-900">Archived stories</p>
              </div>
              <div className="flex items-center gap-2">
                {archivedCount > 0 && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {archivedCount}
                  </span>
                )}
                <span className="text-xs text-gray-300">›</span>
              </div>
            </button>
          </div>

          {/* Privacy */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Privacy</p>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Public Profile</p>
                <p className="text-xs text-gray-400 mt-0.5">Anyone can view your profile</p>
              </div>
              <button
                onClick={handleTogglePrivacy}
                disabled={isPrivate === null}
                aria-busy={isPrivate === null}
                className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors disabled:cursor-default ${isPrivate === null ? 'bg-gray-100' : isPrivate ? 'bg-gray-200' : 'bg-black'}`}
              >
                {isPrivate !== null && (
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPrivate ? 'left-0.5' : 'right-0.5'}`} />
                )}
              </button>
            </div>
            <button
              onClick={handleDownloadData}
              disabled={exporting}
              aria-busy={exporting}
              className="w-full flex items-center justify-between py-2 group disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5 text-left">
                <Download size={16} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <BusyLabel busy={exporting} label="Preparing…" tone="dark" size={12}>Download my data</BusyLabel>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Your profile and stories as a file</p>
                </div>
              </div>
            </button>
            {exportError && <p className="text-xs text-red-600 mt-1">{exportError}</p>}
            <button
              onClick={() => setShowDelete(true)}
              className="w-full text-left py-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Delete my account
            </button>
            <div className="flex gap-4 pt-2 text-xs text-gray-400">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Terms of Service</a>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Privacy Policy</a>
            </div>
          </div>

          {/* Appearance — gated behind ENABLE_DARK_MODE feature flag */}
          {ENABLE_DARK_MODE && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Appearance</p>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Dark Mode</p>
                  <p className="text-xs text-gray-400 mt-0.5">Visual changes coming soon</p>
                </div>
                {/* Toggle — wired to ENABLE_DARK_MODE intent, visual only for now */}
                <div className="w-11 h-6 bg-gray-200 rounded-full relative cursor-pointer opacity-50">
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Log out */}
        <div className="px-5 pb-8 pt-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </motion.div>
        </>
      )}

      {showArchives && (
        <ArchivesModal onClose={() => setShowArchives(false)} onRestored={onArchivesChanged} />
      )}

      {showDelete && (
        <DeleteAccountSheet
          username={currentUser?.username || user?.username}
          onClose={() => setShowDelete(false)}
          onDownload={handleDownloadData}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, note }) {
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  );
}