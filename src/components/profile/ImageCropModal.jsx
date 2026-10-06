import { useState, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check } from '@/components/icons';

// Simple pan+zoom crop UI — no external library needed
export default function ImageCropModal({ imageUrl, aspectRatio = 1, onConfirm, onCancel }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

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

  const onPointerUp = () => { dragging.current = false; };

  const handleConfirm = useCallback(async () => {
    // Draw onto canvas and export
    const container = containerRef.current;
    if (!container) { onConfirm(imageUrl); return; }

    const rect = container.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const size = 600;
    canvas.width = size;
    canvas.height = Math.round(size / aspectRatio);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const displayW = rect.width * scale;
      const displayH = rect.height * scale;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const dispAspect = displayW / displayH;

      let renderedW, renderedH;
      if (imgAspect > dispAspect) {
        renderedH = displayH;
        renderedW = displayH * imgAspect;
      } else {
        renderedW = displayW;
        renderedH = displayW / imgAspect;
      }

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const imgLeft = centerX - renderedW / 2 + offset.x;
      const imgTop = centerY - renderedH / 2 + offset.y;

      const scaleToCanvas = size / rect.width;
      ctx.drawImage(
        img,
        imgLeft * scaleToCanvas,
        imgTop * scaleToCanvas,
        renderedW * scaleToCanvas,
        (renderedH * scaleToCanvas) / aspectRatio
      );

      canvas.toBlob(blob => {
        if (!blob) { onConfirm(imageUrl); return; }
        const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
        onConfirm(file);
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => onConfirm(imageUrl);
    img.src = imageUrl;
  }, [imageUrl, scale, offset, aspectRatio, onConfirm]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <X size={18} />
        </button>
        <span className="text-white text-sm font-medium">Move and zoom</span>
        <button onClick={handleConfirm} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black">
          <Check size={18} />
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing select-none"
          style={{ width: '100%', aspectRatio: `${aspectRatio}/1`, maxHeight: '70vh', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="absolute max-w-none"
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
        </div>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-4 py-6 flex-shrink-0">
        <button
          onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(2)))}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ZoomOut size={18} />
        </button>
        <input
          type="range"
          min={0.5} max={3} step={0.05}
          value={scale}
          onChange={e => setScale(+e.target.value)}
          className="w-40 accent-white"
        />
        <button
          onClick={() => setScale(s => Math.min(3, +(s + 0.1).toFixed(2)))}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ZoomIn size={18} />
        </button>
      </div>
    </div>
  );
}