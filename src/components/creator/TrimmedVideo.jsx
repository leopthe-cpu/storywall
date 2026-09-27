import { useRef, useEffect } from 'react';

// <video> that honors non-destructive trim points. When trimEnd > 0 the native
// loop is disabled and playback is manually looped between trimStart and trimEnd.
// When no trim is set (defaults), it behaves like a normal autoplay/loop video.
export default function TrimmedVideo({ src, trimStart = 0, trimEnd = 0, autoPlay, muted, loop, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = null;

    const onLoaded = () => {
      if (trimStart > 0) {
        try { v.currentTime = trimStart; } catch {}
      }
    };
    const tick = () => {
      if (trimEnd > 0 && v.currentTime >= trimEnd) {
        v.currentTime = trimStart > 0 ? trimStart : 0;
      }
      raf = requestAnimationFrame(tick);
    };

    v.addEventListener('loadedmetadata', onLoaded);
    if (trimEnd > 0) raf = requestAnimationFrame(tick);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [src, trimStart, trimEnd]);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop && trimEnd === 0}
      playsInline
      preload="metadata"
      {...rest}
    />
  );
}