import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import MinimalSlider from '@/components/creator/MinimalSlider';
import { Check, EmojiSad } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';

const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

// Inline square crop/zoom editor — no full-screen modal
export default function InlinePhotoCrop({ imageUrl, onSaved, onDiscard, size = 200 }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset state when imageUrl changes (new photo selected)
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [imageUrl]);

  // Pointer drag
  const onPointerDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; lastPinchDist.current = null; };

  const isTouch = isTouchDevice();

  // Touch pinch zoom
  const onTouchMove = (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (lastPinchDist.current !== null) {
      const delta = dist - lastPinchDist.current;
      setScale(s => Math.min(4, Math.max(0.5, +(s + delta * 0.005).toFixed(3))));
    }
    lastPinchDist.current = dist;
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let urlToProcess = imageUrl;

      // If it's a remote URL (not a blob), fetch it first to avoid CORS canvas tainting
      if (!imageUrl.startsWith('blob:')) {
        const resp = await fetch(imageUrl);
        const blob = await resp.blob();
        urlToProcess = URL.createObjectURL(blob);
      }

      // Crop using the (now local) blob URL
      const container = containerRef.current;
      if (!container) { onSaved(imageUrl); return; }
      const rect = container.getBoundingClientRect();
      const size = 800;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let baseW, baseH;
          if (imgAspect >= 1) { baseH = rect.height; baseW = baseH * imgAspect; }
          else { baseW = rect.width; baseH = baseW / imgAspect; }
          const renderedW = baseW * scale;
          const renderedH = baseH * scale;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const imgLeft = centerX - renderedW / 2 + offset.x;
          const imgTop = centerY - renderedH / 2 + offset.y;
          const ratio = size / rect.width;
          ctx.drawImage(img, imgLeft * ratio, imgTop * ratio, renderedW * ratio, renderedH * ratio);
          resolve();
        };
        img.onerror = reject;
        img.src = urlToProcess;
      });

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (blob) {
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        onSaved(file_url);
      } else {
        onSaved(imageUrl);
      }
    } catch (err) {
      console.error('Crop/upload failed:', err);
      onSaved(imageUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    // onDiscard is reused here to signal "load new image into editor"
    onDiscard(url);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Crop frame */}
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl bg-[#ECE9E1] cursor-grab active:cursor-grabbing select-none flex-shrink-0"
          style={{ width: size, height: size, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchMove={onTouchMove}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
              transformOrigin: 'center',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              userSelect: 'none',
            }}
          />
          {/* Crop border hint */}
          <div className="absolute inset-0 rounded-2xl ring-2 ring-[#262624]/30 pointer-events-none" />
        </div>
      </div>

      {/* Zoom — desktop only (touch uses pinch). Same slider as the rest of the product. */}
      {!isTouch && (
        <div style={{ width: size }}>
          <MinimalSlider dark={false} min={1} max={3} step={0.01} value={scale} onChange={setScale} resetValue={1} ariaLabel="Zoom" />
        </div>
      )}

      <p className="text-xs text-[#8A877F]">
        {isTouch
          ? 'Drag to reposition · Pinch to zoom'
          : 'Drag to reposition · Use slider to zoom'}
      </p>

      {/* Actions: Replace (text) · Discard (emoji) · Save (check, primary) */}
      <div className="flex items-center gap-2 w-full" style={{ maxWidth: size }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 h-11 bg-[#ECE9E1] text-[#3A3935] text-sm font-medium rounded-xl hover:bg-[#E6E0D2] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Replace
        </button>
        <button
          onClick={() => onDiscard(null)}
          disabled={uploading}
          aria-label="Discard photo"
          title="Discard"
          className="h-11 w-11 shrink-0 flex items-center justify-center bg-[#ECE9E1] text-[#6B6964] rounded-xl hover:bg-[#E6E0D2] hover:text-[#262624] active:scale-[0.96] transition-all disabled:opacity-50"
        >
          <EmojiSad size={22} />
        </button>
        <button
          onClick={handleSave}
          disabled={uploading}
          aria-label="Save photo"
          title="Save"
          className="h-11 w-11 shrink-0 flex items-center justify-center bg-[#262624] text-[#F4F2EC] rounded-xl hover:bg-[#30302E] active:scale-[0.96] transition-all disabled:opacity-50"
        >
          {uploading ? <PixelSpinner size={16} tone="light" /> : <Check size={22} strokeWidth={2.2} />}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}