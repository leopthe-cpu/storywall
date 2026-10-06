// Minimal sleek slider: thin 2px track, small white dot thumb, slightly-lighter
// filled portion behind the thumb. Used for zoom, intensity, and other 1D sliders.
//
// `resetValue` (optional): draws a small tick on the track at this value —
// the point a control resets/snaps back to conceptually (e.g. 0 for a
// signed effect strength, 100 for zoom). Purely visual, doesn't affect drag.
//
// `compact` (default ON — this is now the app-wide standard): renders the whole
// control narrower and centered instead of edge-to-edge. Being narrower and inset from the container's
// edges also means a drag doesn't start right at the screen edge, which on
// mobile is where the browser's edge-swipe back/forward gesture lives — a
// full-width slider flush against the side of the screen risks triggering
// that gesture instead of moving the thumb. Pass compact={false}
// only where a full-width track is genuinely needed.
//
// `dark` (default true) is for the dark builder UI; dark={false} is the light
// variant (beige/ink) used on light screens such as the profile-photo cropper.
export default function MinimalSlider({ value, min = 0, max = 100, step = 1, onChange, dark = true, resetValue, compact = true, ariaLabel }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const resetPct = resetValue != null && max > min ? ((resetValue - min) / (max - min)) * 100 : null;
  const trackColor = dark ? '#444' : '#D6D2C7';
  const fillColor = dark ? '#666' : '#8A877F';
  return (
    <div className={compact ? 'relative mx-auto' : 'relative w-full'} style={{ height: 20, width: compact ? '62%' : undefined }}>
      <div
        className="absolute left-0 right-0"
        style={{ top: '50%', transform: 'translateY(-50%)', height: 2, backgroundColor: trackColor }}
      />
      <div
        className="absolute left-0"
        style={{ top: '50%', transform: 'translateY(-50%)', height: 2, width: `${pct}%`, backgroundColor: fillColor }}
      />
      {resetPct != null && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${resetPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: 8,
            borderRadius: 1,
            background: dark ? 'rgba(244,242,236,0.5)' : 'rgba(38,38,36,0.4)',
          }}
        />
      )}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: dark ? '#F4F2EC' : '#262624',
          boxShadow: dark ? '0 1px 3px rgba(0,0,0,0.35)' : '0 1px 3px rgba(38,38,36,0.35)',
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}