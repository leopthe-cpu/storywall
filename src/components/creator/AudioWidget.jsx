import { useRef, useState, useEffect } from 'react';
import { Play, Pause } from '@/components/icons';

function isDarkBg(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

function fmt(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Compact audio player widget. `interactive` enables play/pause (profile/preview);
// in the creator canvas it renders as a static visual that the drag handler selects.
// Honors non-destructive trim (trimStart/trimEnd) during playback when interactive.
export default function AudioWidget({ url, duration, width, height, interactive, cardBg, trimStart = 0, trimEnd = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [realDuration, setRealDuration] = useState(duration || 0);

  const dark = isDarkBg(cardBg);
  const fg = dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const sub = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const bg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const accent = dark ? '#ffffff' : '#111111';
  const accentFg = dark ? '#111111' : '#ffffff';

  const toggle = (e) => {
    if (!interactive) return;
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    // Seek to trim start if outside the trimmed region.
    const effEnd = trimEnd > 0 ? Math.min(trimEnd, a.duration || trimEnd) : (a.duration || 0);
    if (a.currentTime < trimStart || (effEnd > 0 && a.currentTime >= effEnd)) {
      try { a.currentTime = trimStart; } catch {}
    }
    a.play().catch(() => {});
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const effEnd = trimEnd > 0 ? Math.min(trimEnd, a.duration || trimEnd) : (a.duration || 0);
      if (trimEnd > 0 && a.currentTime >= effEnd) {
        // Loop within the trimmed region while interactive.
        if (interactive) { try { a.currentTime = trimStart; } catch {} }
        else { a.pause(); }
        return;
      }
      const span = trimEnd > 0 ? (effEnd - trimStart) : (a.duration || 0);
      setProgress(span > 0 ? (a.currentTime - trimStart) / span : 0);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => { if (a.duration && isFinite(a.duration)) setRealDuration(a.duration); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('loadedmetadata', onMeta);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('loadedmetadata', onMeta);
    };
  }, [interactive, trimStart, trimEnd]);

  const bars = 18;
  const btnSize = Math.max(18, Math.min(height * 0.62, width * 0.28));
  const iconSize = Math.max(10, btnSize * 0.42);
  const radius = Math.min(14, height * 0.22);

  return (
    <div
      className="w-full h-full flex items-center gap-2"
      style={{ background: bg, color: fg, borderRadius: radius, padding: Math.max(4, height * 0.08) }}
    >
      <button
        onClick={toggle}
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: btnSize, height: btnSize, background: accent, color: accentFg }}
      >
        {interactive && playing ? <Pause size={iconSize} /> : <Play size={iconSize} style={{ marginLeft: 2 }} />}
      </button>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1" style={{ height: '100%' }}>
        <div className="flex items-end gap-[2px]" style={{ height: '52%' }}>
          {Array.from({ length: bars }).map((_, i) => {
            const filled = interactive && (progress * bars) > i;
            const h = 25 + (Math.abs(Math.sin(i * 1.7)) * 75);
            return (
              <div key={i} style={{
                flex: 1,
                height: `${h}%`,
                background: filled ? fg : sub,
                borderRadius: 2,
                minWidth: 1,
              }} />
            );
          })}
        </div>
        <span style={{ color: sub, fontSize: Math.max(8, Math.round(height * 0.16)), fontFamily: 'monospace' }}>
          {fmt(realDuration)}
        </span>
      </div>
      {interactive && <audio ref={audioRef} src={url} preload="metadata" className="hidden" />}
    </div>
  );
}