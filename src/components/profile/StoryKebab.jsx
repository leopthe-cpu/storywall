import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, Trash2, Archive } from 'lucide-react';

// Kebab menu for a story entry on the profile. Owner-only; renders nothing for visitors.
export default function StoryKebab({ onEdit, onDelete, onArchive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const item = (icon, label, fn, danger) => (
    <button
      onClick={() => { setOpen(false); fn?.(); }}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${danger ? 'text-red-600' : 'text-gray-700'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-8 h-8 flex items-center justify-center rounded-full text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
        title="Story options"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30 w-44">
          {item(<Pencil size={15} />, 'Edit', onEdit)}
          {onArchive && item(<Archive size={15} />, 'Archive', onArchive)}
          {item(<Trash2 size={15} />, 'Delete', onDelete, true)}
        </div>
      )}
    </div>
  );
}