import { useState } from 'react';
import { updateMe } from '@/api/storywallApi';
import { PLAIN_THEME, isValidWallTheme } from '@/lib/wallTheme';
import { contrastRatio } from '@/lib/colorContrast';
import BusyLabel from '@/components/ui/BusyLabel';

// "Profile theme" in Settings (decision 49, Lifetime per decision 50): three
// colours for the owner's public wall. Changes show live on the wall behind
// the panel (onPreview) and are kept only on Save; closing Settings without
// saving brings the saved colours back. The database refuses colours from
// anyone without Lifetime; for them the section only says what it is.

const FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'tag', label: 'Tags' },
];

export default function ProfileThemeSection({ currentUser, onPreview, onSaved }) {
  const saved = isValidWallTheme(currentUser?.wall_theme) ? currentUser.wall_theme : null;
  const [draft, setDraft] = useState(saved || PLAIN_THEME);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!currentUser) return null;

  const title = <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Profile theme</p>;
  if (!currentUser.is_lifetime) {
    return (
      <div>
        {title}
        <p className="text-sm font-medium text-gray-900">Your wall&apos;s colours</p>
        <p className="text-xs text-gray-400 mt-0.5">Pick the background, text and tag colours of your wall. For Lifetime supporters.</p>
      </div>
    );
  }

  const change = (key, value) => {
    const next = { ...draft, [key]: value.toUpperCase() };
    setDraft(next);
    setMessage('');
    onPreview?.(next);
  };

  const save = async (theme) => {
    setBusy(true);
    setMessage('');
    try {
      await updateMe({ wall_theme: theme });
      onSaved?.(theme);
      onPreview?.(null);
      if (!theme) setDraft(PLAIN_THEME);
      setMessage(theme ? 'Saved' : 'Back to the plain theme');
    } catch (e) {
      console.error('[ProfileThemeSection] save failed:', e);
      setMessage("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const hardToRead = contrastRatio(draft.bg, draft.text) < 3;
  const unchanged = saved && FIELDS.every(({ key }) => saved[key] === draft[key]);

  return (
    <div>
      {title}
      <div className="space-y-1">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer">
            <span className="text-sm font-medium text-gray-900">{label}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">{draft[key]}</span>
              <input
                type="color"
                value={draft[key]}
                onChange={(e) => change(key, e.target.value)}
                aria-label={`${label} colour`}
                className="w-8 h-8 rounded-md border border-gray-200 bg-white p-0.5 cursor-pointer"
              />
            </span>
          </label>
        ))}
      </div>
      {hardToRead && <p className="text-xs text-amber-600 mt-1">The text may be hard to read on this background.</p>}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => save(draft)}
          disabled={busy || unchanged}
          className="h-8 px-3 rounded-lg bg-black text-white text-xs font-medium disabled:opacity-40"
        >
          <BusyLabel busy={busy} label="Saving…" tone="light" size={12}>Save</BusyLabel>
        </button>
        {saved && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            Plain theme
          </button>
        )}
      </div>
      {message && <p className="text-xs text-gray-500 mt-1.5">{message}</p>}
    </div>
  );
}
