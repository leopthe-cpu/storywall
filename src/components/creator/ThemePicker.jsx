import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Palette, Plus, X } from '@/components/icons';
import { COLOR_THEMES, loadCustomThemes, saveCustomThemes, themeProblems } from '@/lib/colorPalettes';

// Generate's colour theme picker (Oz 2026-10-17). A small button on the
// notes screen opens a sheet of 3-colour squares, Color Hunt style; the
// picked one gets a check, and the button itself shows the picked colours.
// "Create your own" sets all three colours. Nothing else on the notes
// screen changes.

// A theme as a square: background on top (the colour most of the story
// is), then text, then accent.
export function ThemeSwatch({ theme, size = 56, rounded = 10 }) {
  return (
    <div className="overflow-hidden flex flex-col shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]" style={{ width: size, height: size, borderRadius: rounded }}>
      <div style={{ flex: 2, background: theme.dominant }} />
      <div style={{ flex: 1, background: theme.ink }} />
      <div style={{ flex: 1, background: theme.accent }} />
    </div>
  );
}

function ThemeButton({ theme, selected, onClick, onDelete }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={theme.name}
        title={theme.name}
        className={`block rounded-[12px] p-[3px] transition-all active:scale-95 ${selected ? 'ring-2 ring-black' : 'ring-1 ring-transparent hover:ring-black/20'}`}
      >
        <ThemeSwatch theme={theme} size={60} />
        {selected && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
            <Check size={12} />
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${theme.name}`}
          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

const FIELDS = [
  ['dominant', 'Background'],
  ['ink', 'Text'],
  ['accent', 'Accent'],
];

function ThemeEditor({ onSave, onCancel }) {
  const [draft, setDraft] = useState({ dominant: '#1D1F4E', ink: '#F7F5EF', accent: '#FF6B3D' });
  const problems = themeProblems(draft);
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <ThemeSwatch theme={draft} size={72} rounded={12} />
        <div className="flex-1 flex flex-col gap-2">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="color"
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-8 h-8 rounded-[6px] border border-gray-200 bg-white p-0.5 cursor-pointer"
              />
              <span className="w-24">{label}</span>
              <span className="font-mono text-xs text-gray-400 uppercase">{draft[key]}</span>
            </label>
          ))}
        </div>
      </div>
      {problems.length > 0 && (
        <p className="text-xs text-amber-700 mb-3">
          {problems.includes('text') ? 'Text may be hard to read on this background. ' : ''}
          {problems.includes('accent') ? 'Nothing reads well on this accent, so it will only be used sparingly.' : ''}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-900 text-sm font-semibold active:scale-[0.98] transition-all">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave({ ...draft, id: `custom-${Date.now()}`, name: 'Your theme' })}
          className="flex-1 h-11 rounded-xl bg-black text-white text-sm font-semibold active:scale-[0.98] transition-all"
        >
          Save and use
        </button>
      </div>
    </div>
  );
}

export default function ThemePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(loadCustomThemes);

  const pick = (theme) => onChange(value?.id === theme.id ? null : theme);
  const updateCustom = (list) => { setCustom(list); saveCustomThemes(list); };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setEditing(false); }}
        aria-label={value ? `Colour theme: ${value.name}` : 'Colour theme'}
        title="Colour theme"
        className="w-10 h-10 rounded-[8px] flex items-center justify-center bg-white border border-gray-200 shadow-sm hover:border-gray-400 active:scale-95 transition-all"
      >
        {value ? <ThemeSwatch theme={value} size={26} rounded={5} /> : <Palette size={18} className="text-gray-700" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-label="Colour theme"
              className="fixed bottom-0 inset-x-0 z-50 mx-auto max-w-md bg-white rounded-t-3xl px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 text-center">Colour theme</h2>
              <p className="text-sm text-gray-500 text-center mb-5">
                {editing ? 'Pick the three colours of your story.' : 'Pick the colours for your story, or leave it to us.'}
              </p>

              {editing ? (
                <ThemeEditor
                  onCancel={() => setEditing(false)}
                  onSave={(theme) => { updateCustom([theme, ...custom]); onChange(theme); setEditing(false); setOpen(false); }}
                />
              ) : (
                <>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 justify-items-center">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      aria-label="Create your own"
                      title="Create your own"
                      className="w-[66px] h-[66px] rounded-[12px] border-2 border-dashed border-gray-300 text-gray-500 flex items-center justify-center hover:border-gray-500 active:scale-95 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                    {custom.map((t) => (
                      <ThemeButton
                        key={t.id}
                        theme={t}
                        selected={value?.id === t.id}
                        onClick={() => pick(t)}
                        onDelete={() => { updateCustom(custom.filter((c) => c.id !== t.id)); if (value?.id === t.id) onChange(null); }}
                      />
                    ))}
                    {COLOR_THEMES.map((t) => (
                      <ThemeButton key={t.id} theme={t} selected={value?.id === t.id} onClick={() => pick(t)} />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { onChange(null); setOpen(false); }}
                    className={`mt-5 w-full h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${value ? 'bg-gray-100 text-gray-900' : 'bg-black text-white'}`}
                  >
                    {value ? 'No theme: let us choose' : 'Let us choose (default)'}
                  </button>
                  {value && (
                    <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full h-11 rounded-xl bg-black text-white text-sm font-semibold active:scale-[0.98] transition-all">
                      Use {value.name}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
