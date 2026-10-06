import { useState } from 'react';
import { ChevronUp, ChevronDown } from '@/components/icons';

// Shared numeric stepper: minus button + number field + plus button.
// Used for text size and image corner radius so both controls look and
// behave identically. `scaleSteps` (optional) makes the buttons snap to
// a predefined set of values (e.g. type scale) instead of fixed increments.
export default function SizeStepper({ label, value, min = 0, max = 128, step = 1, scaleSteps, onChange }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const current = parseInt(value) || 0;

  // While the field is actively being typed into, track its raw text
  // locally (including a transient empty/incomplete state) instead of
  // clamping on every keystroke. `draft` is null when not editing, so the
  // field otherwise just mirrors `value`. Clamping/committing happens only
  // on blur or Enter — see commitDraft().
  const [draft, setDraft] = useState(null);
  const displayValue = draft !== null ? draft : String(current);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = parseInt(draft);
    onChange(String(Number.isNaN(parsed) ? min : clamp(parsed)));
    setDraft(null);
  };

  const decrement = () => {
    setDraft(null);
    if (scaleSteps) {
      const prev = [...scaleSteps].reverse().find(s => s < current);
      onChange(String(prev ?? Math.max(min, current - step)));
    } else {
      onChange(String(Math.max(min, current - step)));
    }
  };

  const increment = () => {
    setDraft(null);
    if (scaleSteps) {
      const next = scaleSteps.find(s => s > current);
      onChange(String(next ?? Math.min(max, current + step)));
    } else {
      onChange(String(Math.min(max, current + step)));
    }
  };

  return (
    <div>
      <label className="text-white/30 text-[9px] uppercase tracking-wider mb-1 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <button
          onClick={decrement}
          disabled={current <= min}
          className="w-7 h-7 rounded bg-white/10 text-white/60 hover:bg-white/15 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronDown size={14} />
        </button>
        <input
          type="number"
          value={displayValue}
          min={min}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setDraft(String(current))}
          onBlur={commitDraft}
          onKeyDown={(e) => { if (e.key === 'Enter') { commitDraft(); e.target.blur(); } }}
          className="w-12 h-7 text-center bg-white/10 text-white rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={increment}
          className="w-7 h-7 rounded bg-white/10 text-white/60 hover:bg-white/15 transition-colors flex items-center justify-center flex-shrink-0"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}