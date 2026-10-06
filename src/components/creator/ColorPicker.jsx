// Standalone color picker panel — used inside TextPanel, MediaPanel, and ColorPanel
import { useState, useRef, useCallback } from 'react';
import { Clipboard, ChevronLeft, Pipette } from '@/components/icons';
import EyedropperOverlay from './EyedropperOverlay';

function hexToHsv(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h, s, v) {
  h = h / 360; s = s / 100; v = v / 100;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export default function ColorPicker({ color, onChange, onCommit, onClose, dark = false, applyToAll, onApplyToAllChange }) {
  const initial = hexToHsv(color || '#000000');
  const [hue, setHue] = useState(initial.h);
  const [sat, setSat] = useState(initial.s);
  const [val, setVal] = useState(initial.v);
  const [hexInput, setHexInput] = useState(color || '#000000');
  const [picking, setPicking] = useState(false);
  const sbRef = useRef(null);
  const latestColor = useRef(color || '#000000');

  const emitColor = useCallback((h, s, v) => {
    const hex = hsvToHex(h, s, v);
    latestColor.current = hex;
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSbPointer = (e) => {
    e.preventDefault();
    const rect = sbRef.current.getBoundingClientRect();
    const onMove = (ev) => {
      const cx = ev.touches?.[0]?.clientX ?? ev.clientX;
      const cy = ev.touches?.[0]?.clientY ?? ev.clientY;
      const newS = Math.min(100, Math.max(0, ((cx - rect.left) / rect.width) * 100));
      const newV = Math.min(100, Math.max(0, 100 - ((cy - rect.top) / rect.height) * 100));
      setSat(newS); setVal(newV);
      emitColor(hue, newS, newV);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.(latestColor.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    onMove(e);
  };

  const handleHexInput = (v) => {
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const hsv = hexToHsv(v);
      setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
      latestColor.current = v;
      onChange(v);
      onCommit?.(v);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.trim().startsWith('#') ? text.trim() : '#' + text.trim();
      handleHexInput(cleaned);
    } catch {}
  };

  // Eyedropper: use native EyeDropper API where available (desktop Chromium),
  // fall back to an html2canvas-based overlay for other browsers.
  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        handleHexInput(result.sRGBHex);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // user cancelled
        // other error — fall through to fallback
      }
    }
    setPicking(true);
  };

  const handlePick = (hex) => {
    setPicking(false);
    handleHexInput(hex);
  };

  const hueColor = hsvToHex(hue, 100, 100);
  const currentColor = hsvToHex(hue, sat, val);

  const textCls = dark ? 'text-white/40' : 'text-gray-500';
  const inputBg = dark ? 'bg-white/5 border-white/10 text-white/80' : 'bg-gray-100 border-gray-200 text-gray-900';

  return (
    <div className="px-4 py-1.5 flex flex-col gap-2.5">
      {/* Back button */}
      {onClose && (
        <button onClick={onClose} className={`flex items-center gap-1 text-xs ${textCls} hover:text-white transition-colors w-fit`}>
          <ChevronLeft size={14} /> Back
        </button>
      )}

      {/* Swatch + hex + optional scope checkbox */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleEyedropper}
          className="relative w-8 h-8 rounded-xl border border-white/10 flex-shrink-0 overflow-hidden group transition-transform active:scale-95"
          title="Pick color from screen"
          style={{ backgroundColor: currentColor }}
        >
          <span className="absolute inset-0 flex items-center justify-center" style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.9)) drop-shadow(0 0 1px rgba(0,0,0,0.9))' }}>
            <Pipette size={15} className="text-white mix-blend-difference" />
          </span>
        </button>
        <div className={`flex items-center rounded-xl overflow-hidden border ${inputBg} ${onApplyToAllChange ? 'w-32 flex-shrink-0' : 'flex-1'}`}>
          <input
            value={hexInput}
            onChange={e => handleHexInput(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm font-mono px-3 py-2 focus:outline-none"
            placeholder="#000000"
          />
          <button onClick={handlePaste} className={`px-2.5 py-2 ${textCls} hover:text-white transition-colors flex-shrink-0`}>
            <Clipboard size={16} />
          </button>
        </div>
        {onApplyToAllChange && (
          <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none flex-1 min-w-0">
            <input
              type="checkbox"
              checked={!!applyToAll}
              onChange={e => onApplyToAllChange(e.target.checked)}
              className="accent-white w-3.5 h-3.5 flex-shrink-0"
            />
            <span className="truncate">Apply to all</span>
          </label>
        )}
      </div>

      {/* SB picker */}
      <div
        ref={sbRef}
        className="w-full rounded-xl touch-none cursor-crosshair relative flex-shrink-0"
        style={{ height: 100, background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        onPointerDown={handleSbPointer}
      >
        <div
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{ left: `${sat}%`, top: `${100 - val}%` }}
        />
      </div>

      {/* Hue slider — thin rainbow track with a small white dot thumb */}
      <div className="relative" style={{ height: 20 }}>
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full overflow-hidden"
          style={{ height: 6, background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} />
        <input
          type="range" min={0} max={360} step={1} value={hue}
          onChange={e => { const h = Number(e.target.value); setHue(h); emitColor(h, sat, val); }}
          onPointerUp={() => onCommit?.(latestColor.current)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 pointer-events-none"
          style={{ left: `${(hue / 360) * 100}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
        />
      </div>

      {picking && (
        <EyedropperOverlay
          onPick={handlePick}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  );
}