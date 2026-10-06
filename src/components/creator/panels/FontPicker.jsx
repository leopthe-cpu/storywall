import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from '@/components/icons';
import { NEUTRAL_FONTS, DISPLAY_FONTS, ACCENT_FONTS } from '@/lib/fontLibrary';

const GROUPS = [
  { label: 'Default', fonts: NEUTRAL_FONTS, role: 'neutral' },
  { label: 'Display', fonts: DISPLAY_FONTS, role: 'display' },
  { label: 'Accent', fonts: ACCENT_FONTS, role: 'accent' },
];

// Font picker — a compact list that pops up ABOVE the font button (it used
// to take over the whole screen, hiding the card). Tapping a font applies it
// immediately and keeps the list open, so you can scroll through fonts and
// watch the card change live; tap outside the list (or the button) to close.
// Rendered in a portal with fixed positioning so the panel's own scroll
// container can't clip it. titleOnly fonts (Playfair Display, Danfo) are
// disabled when the target element is body text.
export default function FontPicker({ currentFont, onSelect, textType }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const isBody = textType === 'body';

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, 200);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const spaceAbove = r.top - 12;
    setPos({
      left,
      width,
      bottom: window.innerHeight - r.top + 6,
      maxHeight: Math.max(140, Math.min(260, spaceAbove)),
    });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (listRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => place();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Start the list scrolled to the current font.
  useEffect(() => {
    if (!open || !pos || !listRef.current) return;
    const cur = listRef.current.querySelector('[data-current="true"]');
    if (cur) cur.scrollIntoView({ block: 'center' });
    // Only on open, not on every selection while browsing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!pos]);

  const handleSelect = (family, role, font) => {
    if (font?.titleOnly && isBody) return;
    onSelect(family, role);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-7 flex items-center justify-between px-2 rounded text-white/80 text-[11px] transition-colors ${open ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
      >
        <span className="truncate" style={{ fontFamily: currentFont || 'Inter' }}>{currentFont || 'Inter'}</span>
        <ChevronDown size={12} className={`text-white/40 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={listRef}
          className="fixed z-[100] bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-y-auto overscroll-contain"
          style={{ left: pos.left, width: pos.width, bottom: pos.bottom, maxHeight: pos.maxHeight }}
        >
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/30 bg-[#222] sticky top-0 z-10">
                {group.label}
              </div>
              {group.fonts.map((f) => {
                const blocked = f.titleOnly && isBody;
                const isCurrent = currentFont === f.family;
                return (
                  <button
                    key={f.family}
                    data-current={isCurrent ? 'true' : undefined}
                    onClick={() => handleSelect(f.family, group.role, f)}
                    disabled={blocked}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      blocked
                        ? 'text-white/20 cursor-not-allowed'
                        : isCurrent
                          ? 'text-white font-medium bg-white/10'
                          : 'text-white/70 hover:bg-white/5'
                    }`}
                    style={{ fontFamily: f.family, fontWeight: group.role === 'display' ? 700 : 400 }}
                  >
                    <span className="truncate">{f.family}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {blocked && <span className="text-[9px] text-white/20">title only</span>}
                      {isCurrent && !blocked && <Check size={14} className="text-white/50" />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
