import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Copy, GripVertical, Trash2, Plus } from '@/components/icons';

// Kebab menu of per-thumbnail actions: Duplicate (or Add to card) · Reorder · Delete
//
// `addToCard`, when passed (Media/Text gallery items only — CardsPanel still
// uses plain same-card `onDuplicate`), replaces the "Duplicate" row with an
// "Add to card" row that expands into a numbered grid of every card in the
// story: { cards, currentIndices, onPick(cardIndex) }. `currentIndices`
// (card indices this item is already placed on) get a filled/green tile so
// it's clear at a glance where a copy already lives.
export default function ThumbMenu({ onDuplicate, onReorder, onDelete, deleteDisabled, deleteTitle, addToCard }) {
  const [open, setOpen] = useState(false);
  const [pickingCard, setPickingCard] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) { setPickingCard(false); return; }
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="More"
        className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <MoreVertical size={12} className="text-white/60" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 w-32 bg-[#2A2A2A] rounded-lg border border-white/10 overflow-hidden shadow-xl">
          {pickingCard && addToCard ? (
            <div className="p-2">
              <p className="text-[9px] text-white/40 px-0.5 pb-1.5 uppercase tracking-wider">Add to card</p>
              <div className="grid grid-cols-4 gap-1">
                {addToCard.cards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setOpen(false); addToCard.onPick(i); }}
                    title={`Card ${i + 1}`}
                    className={`w-6 h-6 rounded text-[10px] font-medium flex items-center justify-center transition-colors ${
                      addToCard.currentIndices?.includes(i)
                        ? 'bg-emerald-400 text-black'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {addToCard ? (
                <button
                  onClick={() => setPickingCard(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors"
                >
                  <Plus size={12} /> Add to card
                </button>
              ) : (
                <button
                  onClick={() => { setOpen(false); onDuplicate?.(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors"
                >
                  <Copy size={12} /> Duplicate
                </button>
              )}
              {onReorder && (
              <button
                onClick={() => { setOpen(false); onReorder(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors"
              >
                <GripVertical size={12} /> Reorder
              </button>
              )}
              <button
                onClick={() => { setOpen(false); onDelete?.(); }}
                disabled={deleteDisabled}
                title={deleteTitle}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-red-500/20 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Bar shown while a gallery is in reorder mode
export function ReorderBar({ onDone, label = 'Tap arrows to reorder' }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-white/5">
      <span className="text-white/50 text-[11px]">{label}</span>
      <button
        onClick={onDone}
        className="px-3 py-1 rounded bg-white text-black text-xs font-medium"
      >
        Done
      </button>
    </div>
  );
}