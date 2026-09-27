import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
      {/* Crop frame + optional vertical slider */}
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl bg-gray-100 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
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
          <div className="absolute inset-0 rounded-2xl ring-2 ring-black/30 pointer-events-none" />
        </div>

        {/* Vertical zoom slider — desktop only */}
        {!isTouch && (
          <div className="flex flex-col items-center" style={{ height: size }}>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={e => setScale(+e.target.value)}
              className="flex-1"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                appearance: 'slider-vertical',
                WebkitAppearance: 'slider-vertical',
                width: 24,
                height: '100%',
                cursor: 'ns-resize',
              }}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {isTouch
          ? 'Drag to reposition · Pinch to zoom'
          : 'Drag to reposition · Use slider to zoom'}
      </p>

      {/* Action buttons */}
      <div className="flex gap-2 w-full" style={{ maxWidth: size }}>
        <button
          onClick={handleSave}
          disabled={uploading}
          className="flex-1 bg-black text-white text-sm font-medium py-2 rounded-xl disabled:opacity-50 hover:bg-gray-900 transition-colors"
        >
          {uploading ? '…' : 'Save'}
        </button>
        <button
          onClick={() => onDiscard(null)}
          disabled={uploading}
          className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Discard
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2 rounded-xl hover:bg-gray-200 transition-colors"
        >
          Change
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}