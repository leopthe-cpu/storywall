import { useState, useRef, useEffect } from 'react';
import { updateMe } from '@/api/storywallApi';
import { PLAIN_THEME, THEME_PRESETS, isValidWallTheme, presetOf, wallThemeVars } from '@/lib/wallTheme';
import { contrastRatio } from '@/lib/colorContrast';
import BusyLabel from '@/components/ui/BusyLabel';

// Settings → Theme (decision 49, Lifetime per decision 50): the colours of
// the owner's public wall. Ready-made themes (THEME_PRESETS) are a starting
// point; each of the three colours can then be changed. Changes show live in
// the preview here and on the wall behind (onPreview) and are kept only on
// Save; leaving without saving brings the saved colours back. Saving the
// plain colours clears the theme. The database refuses colours from anyone
// without Lifetime; for them this screen only says what it is.
// registerGuard lets Settings ask "save your changes?" before leaving.

const FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'tag', label: 'Tags' },
];

const sectionTitle = 'font-mono text-xs font-bold uppercase tracking-wider text-[#6B6964] mx-1 mb-1.5';

export default function ThemeSettings({ currentUser, onPreview, onSaved, registerGuard }) {
  const initial = isValidWallTheme(currentUser?.wall_theme) ? currentUser.wall_theme : null;
  // The colours as last saved (kept here: currentUser isn't refetched).
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial || PLAIN_THEME);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Read by Settings when someone leaves this screen (filled in below once
  // the draft is known; nothing to save for people without Lifetime).
  const guardRef = useRef({ isDirty: () => false, save: async () => true, discard: () => {} });
  useEffect(() => {
    registerGuard?.({
      isDirty: () => guardRef.current.isDirty(),
      save: () => guardRef.current.save(),
      discard: () => guardRef.current.discard(),
    });
    return () => registerGuard?.(null);
  }, []);

  if (!currentUser) return null;

  if (!currentUser.is_lifetime) {
    return (
      <div className="px-4 py-5">
        <p className="text-[15px] font-medium text-[#262624]">Your wall&apos;s colours</p>
        <p className="text-[13px] text-[#6B6964] mt-1">
          Pick a theme for your wall, then change its background, text and tag colours. For Lifetime supporters.
        </p>
      </div>
    );
  }

  const apply = (next) => {
    setDraft(next);
    setMessage('');
    onPreview?.(next);
  };
  const change = (key, value) => apply({ ...draft, [key]: value.toUpperCase() });

  const picked = presetOf(draft);
  const isPlain = picked?.id === 'plain';
  const unchanged = saved ? FIELDS.every(({ key }) => saved[key] === draft[key]) : isPlain;

  const save = async () => {
    // The plain colours are the default: saving them clears the theme.
    const theme = isPlain ? null : { bg: draft.bg, text: draft.text, tag: draft.tag };
    setBusy(true);
    setMessage('');
    try {
      await updateMe({ wall_theme: theme });
      setSaved(theme);
      onSaved?.(theme);
      onPreview?.(null);
      setMessage('Saved');
      return true;
    } catch (e) {
      console.error('[ThemeSettings] save failed:', e);
      setMessage("Couldn't save. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const hardToRead = contrastRatio(draft.bg, draft.text) < 3;
  guardRef.current = { isDirty: () => !unchanged, save, discard: () => onPreview?.(null) };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* The wall's top, in the colours being tried. */}
        <div
          className="rounded-xl border border-[#D6D2C7] p-4 bg-wall-bg flex flex-col gap-1.5"
          style={wallThemeVars(draft) || undefined}
          aria-label="Preview of your wall's colours"
        >
          <p className="font-mono text-xs text-wall-text-2">storywall.io/{currentUser.username}</p>
          <p className="font-display text-xl font-medium text-wall-title">{currentUser.display_name || currentUser.full_name || currentUser.username}</p>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {['Leadership', 'User Research'].map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-wall-tag text-wall-tag-text border border-wall-tag-border">{t}</span>
            ))}
          </div>
        </div>

        <section>
          <h3 className={sectionTitle}>Pick a theme</h3>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => apply({ bg: p.bg, text: p.text, tag: p.tag })}
                aria-pressed={picked?.id === p.id}
                className={`flex items-center gap-2.5 min-h-[52px] px-2.5 py-2 rounded-xl bg-[#F4F2EC] text-left ${picked?.id === p.id ? 'border-2 border-[#262624]' : 'border border-[#D6D2C7]'}`}
              >
                <span aria-hidden="true" className="flex w-9 h-9 rounded-lg overflow-hidden border border-[#D6D2C7] shrink-0">
                  <span className="flex-[2]" style={{ background: p.bg }} />
                  <span className="flex-1" style={{ background: p.text }} />
                  <span className="flex-1" style={{ background: p.tag }} />
                </span>
                <span className="text-sm text-[#262624]">{p.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Edit colours</h3>
          <div className="rounded-xl border border-[#D6D2C7] bg-[#F4F2EC] divide-y divide-[#D6D2C7]">
            {FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 min-h-[52px] px-4 cursor-pointer">
                <span className="flex-1 text-[15px] text-[#262624]">{label}</span>
                <span className="font-mono text-xs text-[#6B6964]">{draft[key]}</span>
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                  aria-label={`${label} colour`}
                  className="w-9 h-9 rounded-lg border border-[#D6D2C7] bg-[#FAF9F5] p-0.5 cursor-pointer"
                />
              </label>
            ))}
          </div>
          {hardToRead && <p className="text-[13px] text-amber-700 mt-1.5 mx-1">The text may be hard to read on this background.</p>}
          <p className="text-[13px] text-[#6B6964] mt-1.5 mx-1">
            {picked ? `Start from a theme, then change any colour.` : 'Your own colours.'} Your wall shows the change live; it&apos;s kept when you save.
          </p>
        </section>
      </div>

      <div className="sticky bottom-0 bg-[#FAF9F5] border-t border-[#D6D2C7] px-4 pt-3 pb-4">
        {message && <p className="text-[13px] text-[#6B6964] mb-2">{message}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => apply(PLAIN_THEME)}
            disabled={busy || isPlain}
            className="flex-1 h-12 rounded-lg border border-[#D6D2C7] bg-[#F4F2EC] text-[15px] font-medium text-[#262624] disabled:opacity-40"
          >
            Reset to Plain
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || unchanged}
            className="flex-1 h-12 rounded-lg bg-[#262624] text-[15px] font-medium text-[#F4F2EC] disabled:opacity-40"
          >
            <BusyLabel busy={busy} label="Saving…" tone="light" size={12}>Save</BusyLabel>
          </button>
        </div>
      </div>
    </div>
  );
}
