import { useEffect, useRef } from 'react';
import { CARD_SIZES, CARD_SIZE_ORDER } from '@/lib/cardGeometry';
import { CardSizeIcon } from './CardSizePicker';

// The four card sizes to pick from when adding a card (Oz, 2026-10-27: a
// story can mix sizes, and "Add" offers all four). Rendered by the button
// that opened it, positioned by `className`. A press anywhere outside closes
// it: a listener rather than a full-screen layer, because on desktop the
// card sits inside a transform, which would stack such a layer above the menu.
export default function AddCardMenu({ onPick, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  return (
    <div ref={ref} role="menu" aria-label="Add a card" className={`absolute z-50 w-44 rounded-xl bg-[#222] border border-white/10 shadow-xl p-1 ${className}`}>
      {CARD_SIZE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); onPick(id); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm text-white/80 hover:bg-white/10 transition-colors"
        >
          <span className="w-5 flex justify-center"><CardSizeIcon id={id} h={14} /></span>
          <span className="flex-1">{CARD_SIZES[id].label}</span>
          <span className="text-xs text-white/40">{id}</span>
        </button>
      ))}
    </div>
  );
}
