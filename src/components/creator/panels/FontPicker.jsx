import { useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { NEUTRAL_FONTS, DISPLAY_FONTS, ACCENT_FONTS } from '@/lib/fontLibrary';

const GROUPS = [
  { label: 'Default', fonts: NEUTRAL_FONTS, role: 'neutral' },
  { label: 'Display', fonts: DISPLAY_FONTS, role: 'display' },
  { label: 'Accent', fonts: ACCENT_FONTS, role: 'accent' },
];

// Font picker — opens as a full-screen overlay so the list never collides
// with the browser's bottom UI (tab bar, inertia scroll). titleOnly fonts
// (Playfair Display, Danfo) are disabled when the target element is body text.
export default function FontPicker({ currentFont, onSelect, textType }) {
  const [open, setOpen] = useState(false);
  const isBody = textType === 'body';

  const handleSelect = (family, role, font) => {
    if (font?.titleOnly && isBody) return;
    setOpen(false);
    onSelect(family, role);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-white/10 text-white/80 text-[11px] hover:bg-white/15 transition-colors"
      >
        <span className="truncate">{currentFont || 'Inter'}</span>
        <ChevronDown size={12} className="text-white/40 flex-shrink-0 ml-1" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-[#1A1A1A] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
            <span className="text-white text-sm font-medium">Font</span>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg bg-white/10 text-white/60 hover:bg-white/15 transition-colors flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          {/* Font list — scrollable, overscroll-contained so the browser
              doesn't take over near its own chrome */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {GROUPS.map(group => (
              <div key={group.label}>
                <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 bg-white/5 sticky top-0">
                  {group.label}
                </div>
                {group.fonts.map(f => {
                  const blocked = f.titleOnly && isBody;
                  return (
                    <button
                      key={f.family}
                      onClick={() => handleSelect(f.family, group.role, f)}
                      disabled={blocked}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                        blocked
                          ? 'text-white/20 cursor-not-allowed'
                          : currentFont === f.family
                            ? 'text-white font-medium bg-white/5'
                            : 'text-white/70 hover:bg-white/5'
                      }`}
                      style={{ fontFamily: f.family, fontWeight: group.role === 'display' ? 700 : 400 }}
                    >
                      <span>{f.family}</span>
                      <span className="flex items-center gap-2">
                        {blocked && <span className="text-[9px] text-white/20">title only</span>}
                        {currentFont === f.family && !blocked && <Check size={14} className="text-white/40" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {/* Bottom spacer so the last items clear any browser chrome */}
            <div className="h-8" />
          </div>
        </div>
      )}
    </>
  );
}