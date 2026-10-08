import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from '@/components/icons';

function fmt(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Non-destructive trim editor for audio & video elements. Stores trimStart and
// trimEnd (seconds) on the element. The original file is never modified.
export default function TrimPanel({ element, onUpdateElement }) {
  const mediaRef = useRef(null);
  const trackRef = useRef(null);
  const isVideo = element?.type === 'video';

  const [duration, setDuration] = useState(element?.duration || 0);
  const [start, setStart] = useState(element?.trimStart || 0);
  const [end, setEnd] = useState(element?.trimEnd || 0); // 0 = full
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const effectiveEnd = end > 0 ? Math.min(end, duration || end) : (duration || 0);

  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    const onMeta = () => { if (m.duration && isFinite(m.duration)) setDuration(m.duration); };
    const onTime = () => setCurrentTime(m.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    m.addEventListener('loadedmetadata', onMeta);
    m.addEventListener('timeupdate', onTime);
    m.addEventListener('play', onPlay);
    m.addEventListener('pause', onPause);
    return () => {
      m.removeEventListener('loadedmetadata', onMeta);
      m.removeEventListener('timeupdate', onTime);
      m.removeEventListener('play', onPlay);
      m.removeEventListener('pause', onPause);
    };
  }, []);

  // Stop at the trim end and reset to the trim start.
  useEffect(() => {
    const m = mediaRef.current;
    if (!m || !playing) return;
    if (effectiveEnd > 0 && currentTime >= effectiveEnd) {
      m.pause();
      try { m.currentTime = start; } catch {}
      setPlaying(false);
    }
  }, [currentTime, effectiveEnd, playing, start]);

  const togglePlay = () => {
    const m = mediaRef.current;
    if (!m) return;
    if (playing) { m.pause(); return; }
    if (m.currentTime < start || (effectiveEnd > 0 && m.currentTime >= effectiveEnd)) {
      try { m.currentTime = start; } catch {}
    }
    m.play().catch(() => {});
  };

  const commit = useCallback((s, e) => {
    const updates = { trimStart: Math.round(s * 100) / 100 };
    updates.trimEnd = e > 0 ? Math.round(e * 100) / 100 : 0;
    onUpdateElement(updates);
  }, [onUpdateElement]);

  const timeFromPointer = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * (duration || 0);
  };

  const startHandleDrag = (which) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev) => {
      const t = timeFromPointer(ev.touches?.[0]?.clientX ?? ev.clientX);
      if (which === 'start') {
        const ns = Math.max(0, Math.min(t, (effectiveEnd || duration) - 0.5));
        setStart(ns);
        commit(ns, end);
      } else {
        const ne = Math.max((start || 0) + 0.5, Math.min(t, duration || t));
        const realEnd = ne >= duration ? 0 : ne;
        setEnd(realEnd);
        commit(start, realEnd);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const reset = () => {
    setStart(0);
    setEnd(0);
    commit(0, 0);
    const m = mediaRef.current;
    if (m) { try { m.currentTime = 0; } catch {} }
  };

  const dur = duration || 0;
  const startPct = dur ? (start / dur) * 100 : 0;
  const endPct = dur ? (effectiveEnd / dur) * 100 : 100;
  const playPct = dur ? (currentTime / dur) * 100 : 0;
  const hasMedia = !!element?.image_url;

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-4">
        {/* Preview media (hidden video surface, audio has no surface) */}
        <div className="flex items-center justify-center bg-black/30 rounded-xl overflow-hidden" style={{ height: isVideo ? 120 : 0 }}>
          {isVideo && hasMedia && (
            <video ref={mediaRef} src={element.image_url} preload="metadata" className="h-full w-full object-contain" />
          )}
        </div>
        {!isVideo && hasMedia && (
          <audio ref={mediaRef} src={element.image_url} preload="metadata" className="hidden" />
        )}

        {/* Play / pause */}
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlay}
            disabled={!hasMedia}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          >
            {playing ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
          </button>
        </div>

        {/* Timeline */}
        <div>
          <div ref={trackRef} className="relative w-full rounded-full bg-white/10 touch-none" style={{ height: 36 }}>
            {/* Selected region */}
            <div
              className="absolute top-0 bottom-0 bg-white/25 rounded-full"
              style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
            />
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
              style={{ left: `${playPct}%` }}
            />
            {/* Start handle */}
            <div
              onPointerDown={startHandleDrag('start')}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-9 bg-white rounded-md shadow flex items-center justify-center cursor-ew-resize touch-none"
              style={{ left: `${startPct}%` }}
            >
              <div className="w-0.5 h-4 bg-black/40 rounded" />
            </div>
            {/* End handle */}
            <div
              onPointerDown={startHandleDrag('end')}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-9 bg-white rounded-md shadow flex items-center justify-center cursor-ew-resize touch-none"
              style={{ left: `${endPct}%` }}
            >
              <div className="w-0.5 h-4 bg-black/40 rounded" />
            </div>
          </div>

          {/* Time labels */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-white/70 text-xs font-mono">{fmt(start)}</span>
            <span className="text-white/40 text-xs font-mono">{fmt(dur)}</span>
            <span className="text-white/70 text-xs font-mono">{fmt(effectiveEnd)}</span>
          </div>
        </div>

        <button
          onClick={reset}
          disabled={!hasMedia}
          className="w-full py-2.5 bg-white/10 text-white/70 text-sm rounded hover:bg-white/15 transition-colors disabled:opacity-40"
        >
          Reset trim
        </button>

        {!hasMedia && (
          <p className="text-white/30 text-xs text-center">Select an audio or video element to trim.</p>
        )}
      </div>
    </div>
  );
}