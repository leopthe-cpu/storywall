import { CARD_SIZES } from '@/lib/cardGeometry';

// Order shown: the new-story default (4:5) first.
const OPTIONS = ['4:5', '1:1'];

// The card size choice for a new story (decision 45): Portrait 4:5 or
// Square 1:1, each with a small outline of its shape. Shown in the builder's
// Cards panel (dark) and on the Generate notes screen (light) while the
// story is still empty.
export default function CardSizePicker({ value, onChange, tone = 'dark' }) {
  const dark = tone === 'dark';
  return (
    <div role="radiogroup" aria-label="Card size" className="flex items-center gap-1.5">
      {OPTIONS.map((id) => {
        const size = CARD_SIZES[id];
        const active = value === id;
        // Same green "selected" style as the builder's other pills; the light
        // version matches the notes screen's white buttons.
        const cls = dark
          ? (active ? 'bg-emerald-400/10 border-emerald-400 text-emerald-400' : 'bg-white/10 border-transparent text-white/60 hover:bg-white/15')
          : (active ? 'bg-black border-black text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400');
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border text-xs font-medium transition-colors ${cls}`}
          >
            <span
              aria-hidden="true"
              className="block rounded-[2px] border-[1.5px] border-current"
              style={{ width: 10, height: Math.round(10 * size.height / size.width) }}
            />
            {size.label} {id}
          </button>
        );
      })}
    </div>
  );
}
