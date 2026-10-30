import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogOut, Archive, Download, BarChart, Palette, ChevronLeft, ChevronRight, Trash2, AlertCircle } from '@/components/icons';
import { getMe, signOut, filterPosts, updateMe } from '@/api/storywallApi';
import { motion } from 'framer-motion';
import { ENABLE_DARK_MODE } from '@/lib/featureFlags';
import EditableUsername from '@/components/profile/EditableUsername';
import ArchivesModal from '@/components/profile/ArchivesModal';
import AnalyticsModal from '@/components/profile/AnalyticsModal';
import BusyLabel from '@/components/ui/BusyLabel';
import { downloadMyData } from '@/lib/dataExport';
import DeleteAccountSheet from '@/components/profile/DeleteAccountSheet';
import ThemeSettings from '@/components/profile/ThemeSettings';
import { presetOf } from '@/lib/wallTheme';

// onThemePreview / onThemeSaved: the Theme screen's live preview and saved
// colours, applied by the wall.
export default function BurgerMenu({ user, onClose, onArchivesChanged, onThemePreview, onThemeSaved }) {
  const [currentUser, setCurrentUser] = useState(null);
  // null until the saved setting has loaded: the switch shows neither state
  // and ignores taps, so it never flashes "public" or flips the wrong way.
  const [isPrivate, setIsPrivate] = useState(null);
  const [showArchives, setShowArchives] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const navigate = useNavigate();
  const [archivedCount, setArchivedCount] = useState(0);
  // Which screen of the panel is showing: home | account | theme | about.
  const [screen, setScreen] = useState('home');
  // Leaving Theme without saving puts the saved colours back on the wall.
  const leaveScreen = () => {
    if (screen === 'theme') onThemePreview?.(null);
    setScreen('home');
  };
  const handleThemeSaved = (theme) => {
    setCurrentUser((u) => (u ? { ...u, wall_theme: theme } : u));
    onThemeSaved?.(theme);
  };

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

  const themeName = currentUser ? (presetOf(currentUser.wall_theme)?.name || 'Custom') : null;

  // Email: show the real email if available. If genuinely absent (e.g. Apple
  // hides it), show a provider-based fallback instead of a dash.
  const provider = currentUser?.provider || currentUser?.auth_provider;
  const emailDisplay = currentUser?.email
    || (provider === 'apple' ? 'Provided by Apple'
      : provider === 'google' ? 'Provided by Google'
      : 'Not available');

  return (
    <div className="fixed inset-0 z-50 flex">
      {!showArchives && !showAnalytics && (
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
          long settle kept the menu mounted after it looked closed). Settings
          (Oz, 2026-10-30): a short home list, with Account, Theme and the
          legal pages as screens of their own inside the panel. */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="absolute right-0 top-0 w-full max-w-sm bg-[#FAF9F5] text-[#262624] h-full flex flex-col shadow-xl"
      >
        <PanelHeader
          title={SCREEN_TITLES[screen]}
          onBack={screen === 'home' ? null : leaveScreen}
          onClose={onClose}
          badge={screen === 'theme' ? 'Lifetime' : null}
        />

        <div className="flex-1 overflow-y-auto">
          {screen === 'home' && (
            <div className="px-4 py-4 space-y-5">
              <button
                type="button"
                onClick={() => setScreen('account')}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-[#F4F2EC] border border-[#D6D2C7] text-left"
              >
                <span aria-hidden="true" className="w-12 h-12 rounded-full bg-[#E6E0D2] overflow-hidden flex items-center justify-center font-display text-xl font-medium shrink-0">
                  {/* The wall's own copy of the photo (a public URL). */}
                  {user?.profile_image
                    ? <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                    : (user?.display_name || user?.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium">Account</span>
                  <span className="block font-mono text-[13px] text-[#6B6964] truncate">storywall.io/{user?.username}</span>
                  <span className="block text-[13px] text-[#6B6964]">Username, email, password, privacy, your data</span>
                </span>
                <Chevron />
              </button>

              <Group title="Your wall">
                <Row icon={<Palette size={20} />} label="Theme" detail={themeName} onClick={() => setScreen('theme')} />
                {/* Premium analytics (decision 50). The data function returns
                    nothing to anyone else, so hiding the row is cosmetic. */}
                {currentUser?.is_premium && (
                  <Row icon={<BarChart size={20} />} label="Analytics" onClick={() => setShowAnalytics(true)} />
                )}
                <Row icon={<Archive size={20} />} label="Archived stories" detail={archivedCount > 0 ? String(archivedCount) : null} onClick={() => setShowArchives(true)} />
              </Group>

              <Group title="More">
                <Row icon={<AlertCircle size={20} />} label="Terms, privacy and licences" onClick={() => setScreen('about')} />
              </Group>
            </div>
          )}

          {screen === 'account' && (
            <div className="px-4 py-5 flex flex-col gap-5 min-h-full">
              <div className="rounded-xl bg-[#F4F2EC] border border-[#D6D2C7] divide-y divide-[#D6D2C7]">
                <div className="px-4 py-2">
                  <EditableUsername
                    currentUsername={user?.username}
                    currentUserId={user?.id}
                    onSaved={onClose}
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="text-[13px] text-[#6B6964]">Email</p>
                  <p className="text-[15px] font-medium break-all">{emailDisplay}</p>
                  <p className="text-[13px] text-[#6B6964]">Used to sign in. Never shown on your wall.</p>
                </div>
                {/* Change password: the code-by-email reset flow, started for
                    this account's address. The emailed code proves it's the
                    owner, so no "current password" is asked for. */}
                <Row
                  label="Change password"
                  onClick={() => navigate('/signin/reset', {
                    state: { email: currentUser?.email || '', from: user?.username ? `/${user.username}` : '/', change: true },
                  })}
                />
              </div>

              <div className="rounded-xl bg-[#F4F2EC] border border-[#D6D2C7] px-4 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium">Public profile</p>
                  <p className="text-[13px] text-[#6B6964]">
                    {isPrivate ? 'Only you can see your wall' : 'Anyone with the link can see your wall'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPrivate === null ? undefined : !isPrivate}
                  aria-label="Public profile"
                  onClick={handleTogglePrivacy}
                  disabled={isPrivate === null}
                  aria-busy={isPrivate === null}
                  className={`w-[52px] h-8 rounded-full p-[3px] flex transition-colors disabled:cursor-default ${isPrivate === null ? 'bg-[#ECE9E1]' : isPrivate ? 'bg-[#D6D2C7] justify-start' : 'bg-[#262624] justify-end'}`}
                >
                  {isPrivate !== null && <span className="w-[26px] h-[26px] rounded-full bg-[#FAF9F5] block" />}
                </button>
              </div>

              {/* Your data, last on this screen (Oz, 2026-10-30). The download
                  stays free for everyone: privacy law (PIPEDA, GDPR) gives
                  people access to their own data at no or minimal cost. */}
              <Group title="Your data" className="mt-auto">
                <Row
                  icon={<Download size={20} />}
                  label={<BusyLabel busy={exporting} label="Preparing…" tone="dark" size={12}>Download my data</BusyLabel>}
                  sub="Your profile and stories as a file"
                  onClick={handleDownloadData}
                  disabled={exporting}
                  chevron={false}
                />
                <Row icon={<Trash2 size={20} />} label="Delete account" onClick={() => setShowDelete(true)} danger chevron={false} />
              </Group>
              {exportError && <p className="text-[13px] text-red-600 -mt-3 mx-1">{exportError}</p>}
            </div>
          )}

          {screen === 'theme' && currentUser && (
            <ThemeSettings key={currentUser.id} currentUser={currentUser} onPreview={onThemePreview} onSaved={handleThemeSaved} />
          )}

          {screen === 'about' && (
            <div className="px-4 py-5 space-y-4">
              <Group>
                <Row href="/terms" label="Terms of Service" sub="The rules for using Storywall" />
                <Row href="/privacy" label="Privacy Policy" sub="What we collect and why" />
                <Row href="/about/licenses" label="Open-source licences" sub="Software and fonts Storywall uses" />
              </Group>
              <p className="text-[13px] text-[#6B6964] mx-1">Questions about your data: privacy@storywall.io</p>
            </div>
          )}

          {/* Appearance — gated behind ENABLE_DARK_MODE feature flag */}
          {screen === 'home' && ENABLE_DARK_MODE && (
            <div className="px-4 pb-4">
              <Group title="Appearance">
                <div className="flex items-center justify-between min-h-[52px] px-4">
                  <div>
                    <p className="text-[15px]">Dark Mode</p>
                    <p className="text-[13px] text-[#6B6964]">Visual changes coming soon</p>
                  </div>
                  {/* Toggle — wired to ENABLE_DARK_MODE intent, visual only for now */}
                  <div className="w-11 h-6 bg-[#D6D2C7] rounded-full relative opacity-50">
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-[#FAF9F5] rounded-full" />
                  </div>
                </div>
              </Group>
            </div>
          )}
        </div>

        {/* Log out: on the home list only. */}
        {screen === 'home' && (
          <div className="px-4 pb-8 pt-4 border-t border-[#D6D2C7]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-lg border border-[#D6D2C7] bg-[#F4F2EC] font-medium text-[15px] active:scale-[0.98] transition-all"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </motion.div>
        </>
      )}

      {showArchives && (
        <ArchivesModal onClose={() => setShowArchives(false)} onRestored={onArchivesChanged} />
      )}

      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}

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

const SCREEN_TITLES = {
  home: 'Settings',
  account: 'Account',
  theme: 'Theme',
  about: 'Terms, privacy and licences',
};

function PanelHeader({ title, onBack, onClose, badge }) {
  return (
    <div className="flex items-center gap-1 px-3 py-3 border-b border-[#D6D2C7]">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back to Settings" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#ECE9E1]">
          <ChevronLeft size={20} />
        </button>
      )}
      <h2 className={`flex-1 font-display font-medium truncate ${onBack ? 'text-2xl' : 'text-[28px] leading-[34px] pl-2'}`}>{title}</h2>
      {badge && <span className="font-mono text-[11px] font-bold uppercase tracking-wider bg-[#E6E0D2] px-2 py-0.5 rounded-lg">{badge}</span>}
      <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-full text-[#6B6964] hover:text-[#262624]">
        <X size={20} />
      </button>
    </div>
  );
}

function Group({ title, children, className = '' }) {
  return (
    <section className={className}>
      {title && <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#6B6964] mx-1 mb-1.5">{title}</h3>}
      <div className="rounded-xl bg-[#F4F2EC] border border-[#D6D2C7] overflow-hidden divide-y divide-[#D6D2C7]">{children}</div>
    </section>
  );
}

const Chevron = () => <ChevronRight size={16} className="text-[#6B6964] shrink-0" />;

// One row of a group: a button, or a link (href, opened in a new tab like
// the legal pages always were).
function Row({ icon, label, sub, detail, onClick, href, disabled, danger, chevron = true }) {
  const body = (
    <>
      {icon && <span className={`shrink-0 ${danger ? 'text-red-700' : ''}`}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] ${danger ? 'text-red-700' : ''}`}>{label}</span>
        {sub && <span className="block text-[13px] text-[#6B6964]">{sub}</span>}
      </span>
      {detail && <span className="text-[13px] text-[#6B6964]">{detail}</span>}
      {chevron && <Chevron />}
    </>
  );
  const cls = 'w-full flex items-center gap-3 min-h-[52px] px-4 py-2.5 text-left hover:bg-[#ECE9E1] disabled:opacity-60 transition-colors';
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{body}</button>;
}
