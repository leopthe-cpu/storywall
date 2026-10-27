import { CARD_SIZES, CARD_SIZE_ORDER } from '@/lib/cardGeometry';

// A small outline of a size's shape, fitted in an h × h square.
export function CardSizeIcon({ id, h = 12 }) {
  const size = CARD_SIZES[id];
  const s = h / Math.max(size.width, size.height);
  return (
    <span
      aria-hidden="true"
      className="block rounded-[2px] border-[1.5px] border-current flex-shrink-0"
      style={{ width: Math.max(5, Math.round(size.width * s)), height: Math.max(5, Math.round(size.height * s)) }}
    />
  );
}

// Card size choice (decision 45): one pill per size, each with its shape.
// In the builder's Cards panel it switches the current card (all four
// sizes, ratio only so they fit a phone); on the Generate notes screen it
// picks the size the story is laid out at (the layout engine's sizes, with
// their names).
export default function CardSizePicker({ value, onChange, tone = 'dark', options = CARD_SIZE_ORDER, showNames = options.length <= 2 }) {
  const dark = tone === 'dark';
  return (
    <div role="radiogroup" aria-label="Card size" className="flex items-center gap-1.5">
      {options.map((id) => {
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
            aria-label={`${size.label} ${id}`}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border text-xs font-medium transition-colors ${cls}`}
          >
            <CardSizeIcon id={id} />
            {showNames ? `${size.label} ${id}` : id}
          </button>
        );
      })}
    </div>
  );
}
