// 8-bit style pixelated loader — the app's one shared loading indicator,
// replacing the old plain CSS "ring" spinners and lucide Loader/Loader2
// icons that were scattered (and visually inconsistent) across every
// loading state. Concept: Fabrizio Bianchi's "8 bit spinner"
// (https://codepen.io/_fbrz/pen/QwYLGV) — a single dot's box-shadow paints
// 8 of 16 positions around a ring, and a shared @keyframes (see
// src/index.css, `.pixel-spinner-dot` / `pixel-spin`) steps that lit arc
// around once per second. Reimplemented here as one reusable component
// (instead of copy-pasted keyframes per usage site) so every instance in
// the app shares the exact same animation and only varies by size/color.
export default function PixelSpinner({ size = 24, color = 'currentColor', className = '' }) {
  // The pattern spans 7 grid units across (the dot itself + 3 units of
  // reach on each side) — scale that grid so the whole spinner fits `size`.
  const unit = size / 7;
  return (
    <span
      className={`inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span
        className="pixel-spinner-dot"
        style={{ width: unit, height: unit, '--pxs-u': `${unit}px`, '--pxs-c': color }}
      />
    </span>
  );
}
