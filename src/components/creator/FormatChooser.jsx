import { CARD_SIZES, CARD_SIZE_ORDER, fitCard } from '@/lib/cardGeometry';

// The four card formats as gallery tiles (Oz, 2026-10-27): shown in the
// Cards gallery while the rest of the builder is dimmed, when adding a card
// or changing one's format. Each tile is the gallery's square slot with the
// format's shape fitted inside. Tapping one picks it; Cancel (or a tap on
// the dimmed area, see StoryCreator) leaves everything as it was.
const SLOT = 64;

export default function FormatChooser({ mode, current, onPick, onCancel }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-white">{mode === 'change' ? 'Change format' : 'Choose a format'}</p>
        <button type="button" onClick={onCancel} className="text-xs text-white/50 hover:text-white px-2 py-1">Cancel</button>
      </div>
      <div role="radiogroup" aria-label="Card format" className="flex flex-wrap gap-3">
        {CARD_SIZE_ORDER.map((id) => {
          const box = fitCard(id, SLOT - 16, SLOT - 16);
          const active = mode === 'change' && current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${CARD_SIZES[id].label} ${id}`}
              onClick={() => onPick(id)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`flex items-center justify-center rounded-lg border-2 transition-colors ${active ? 'border-emerald-400' : 'border-white/20 hover:border-white/60'}`}
                style={{ width: SLOT, height: SLOT }}
              >
                <span className="block rounded-[4px] bg-white" style={{ width: box.width, height: box.height }} />
              </span>
              <span className={`text-[10px] ${active ? 'text-emerald-400' : 'text-white/70'}`}>{id}</span>
              <span className="text-[9px] text-white/40 -mt-1.5">{CARD_SIZES[id].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
