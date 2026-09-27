import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Copy, GripVertical, Trash2 } from 'lucide-react';

// Kebab menu of per-thumbnail actions: Duplicate · Reorder · Delete
export default function ThumbMenu({ onDuplicate, onReorder, onDelete, deleteDisabled, deleteTitle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
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
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 w-28 bg-[#2A2A2A] rounded-lg border border-white/10 overflow-hidden shadow-xl">
          <button
            onClick={() => { setOpen(false); onDuplicate?.(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors"
          >
            <Copy size={12} /> Duplicate
          </button>
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