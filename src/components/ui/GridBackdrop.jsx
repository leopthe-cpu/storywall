// The profile/landing paper background: warm base, 38px line grid, and the
// same radial fade from the top. Absolutely positioned to fill its (relative
// or fixed) parent; content above it needs `relative` (z-auto is enough
// since this comes first in the DOM). Values match PublicProfile.jsx.
// fade={false} keeps the grid at full strength over the whole screen.
// drift slowly moves the grid downward forever (see .grid-drift in
// index.css); the base colour stays put, only the lines move.
export const GRID_BASE = '#F4F2EC';

export default function GridBackdrop({ fade = true, drift = false }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: GRID_BASE }} />
      <div
        className={`absolute inset-x-0 bottom-0 ${drift ? 'grid-drift' : ''}`}
        style={{
          // One cell taller than the screen when drifting, so the top never
          // shows a gap while the layer slides down.
          top: drift ? -38 : 0,
          backgroundImage: 'linear-gradient(#E6E0D2 1px, transparent 1px), linear-gradient(90deg, #E6E0D2 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          backgroundPosition: 'center top',
        }}
      />
      {fade && (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(120% 100% at 50% 0%, transparent 0%, ${GRID_BASE} 72%)` }}
        />
      )}
    </div>
  );
}
