import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Custom eyedropper cursor (pipette SVG, hotspot at the tip)
const PIPETTE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/></svg>`;
const EYEDROPPER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PIPETTE_SVG)}") 2 22, crosshair`;

// Fallback color picker for browsers without the native EyeDropper API.
// Captures the current page with html2canvas, shows it as a frozen overlay,
// and reads the pixel color at the click/tap point.
export default function EyedropperOverlay({ onPick, onCancel }) {
  const sourceCanvasRef = useRef(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [error, setError] = useState(false);
  const [cursorColor, setCursorColor] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: null,
          scale: 1,
          logging: false,
          width: window.innerWidth,
          height: window.innerHeight,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
        });
        if (cancelled) return;
        sourceCanvasRef.current = canvas;
        setBgUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('[Eyedropper] capture failed', e);
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getPixelColor = useCallback((clientX, clientY) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(clientX * scaleX)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(clientY * scaleY)));
    try {
      const data = ctx.getImageData(px, py, 1, 1).data;
      return '#' + [data[0], data[1], data[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }, []);

  // ESC to cancel
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleMouseMove = (e) => {
    if (isTouch) return;
    setCursorPos({ x: e.clientX, y: e.clientY });
    setCursorColor(getPixelColor(e.clientX, e.clientY));
  };

  const handleClick = (e) => {
    const color = getPixelColor(e.clientX, e.clientY);
    if (color) onPick(color);
    else onCancel();
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    setIsTouch(true);
    const t = e.touches[0];
    setCursorPos({ x: t.clientX, y: t.clientY });
    setCursorColor(getPixelColor(t.clientX, t.clientY));
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    setCursorPos({ x: t.clientX, y: t.clientY });
    setCursorColor(getPixelColor(t.clientX, t.clientY));
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const color = getPixelColor(t.clientX, t.clientY);
    if (color) onPick(color);
    else onCancel();
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 px-6">
        <p className="text-white text-sm text-center mb-4">Couldn't capture the screen for the eyedropper. Your browser may not support this feature.</p>
        <button onClick={onCancel} className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium">Close</button>
      </div>
    );
  }

  if (!bgUrl) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50">
        <div className="text-white text-sm flex items-center gap-2">
          <PixelSpinner size={16} tone="light" />
          Tap to pick a color
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[10000]"
      style={{
        cursor: isTouch ? 'crosshair' : EYEDROPPER_CURSOR,
        touchAction: 'none',
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'top left',
        backgroundRepeat: 'no-repeat',
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onCancel(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center z-10 hover:bg-black/80 transition-colors"
      >
        <X size={20} />
      </button>

      {cursorColor && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: cursorPos.x + 16,
            top: cursorPos.y + 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            backgroundColor: cursorColor,
          }}
        >
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap font-mono">{cursorColor}</span>
        </div>
      )}
    </div>
  );
}