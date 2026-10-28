import { useState, useRef, useEffect } from 'react';
import { uploadPublicFile } from '@/api/storywallApi';
import MinimalSlider from '@/components/creator/MinimalSlider';
import { Check, EmojiSad, ImageIcon } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';
import { toast } from '@/components/ui/use-toast';
import { heicToJpeg, HEIC_FAILED_MESSAGE } from '@/lib/heicConvert';

const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

// Inline square crop/zoom editor — no full-screen modal.
//
// With `commitRef`, the parent saves the crop itself (onboarding saves it with
// "Finish Wall", Oz 13 Oct 2026): the ✓ and ☹ buttons are hidden, Replace sits
// on the photo, and commitRef.current() crops + uploads and resolves to the
// new URL (null if the upload failed; the editor then shows the error).
export default function InlinePhotoCrop({ imageUrl, onSaved, onDiscard, size = 200, commitRef }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const dragging = useRef(false);
  const pointers = useRef(new Set());
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset state when imageUrl changes (new photo selected)
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [imageUrl]);

  // The photo must always cover the whole frame (Oz, 13 Oct 2026): at zoom 1
  // it already fills it, so there is nothing to move; zoomed in, it can move
  // only as far as it still covers every edge. The preview shows the photo
  // cover-fitted to the frame and scaled about the centre, so at zoom s it
  // overhangs each side by (s - 1) * size / 2. Keeping the offset within
  // that also makes the saved crop identical to the preview (the save draws
  // from the full photo, which beyond that limit would differ).
  const clampOffset = (o, s) => {
    const limit = Math.max(0, (s - 1) * size / 2);
    return {
      x: Math.min(limit, Math.max(-limit, o.x)),
      y: Math.min(limit, Math.max(-limit, o.y)),
    };
  };

  // Zooming out pulls the photo back so it still covers the frame.
  useEffect(() => {
    setOffset(o => clampOffset(o, scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, size]);

  // Pointer drag. On a phone each finger of a pinch is its own pointer: if
  // both moved the photo, it jumped back and forth between the two fingers
  // while pinching (Oz, 13 Oct 2026). So only a single pointer drags, and the
  // drag restarts from wherever the remaining finger is after a pinch.
  const onPointerDown = (e) => {
    pointers.current.add(e.pointerId);
    dragging.current = pointers.current.size === 1;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (pointers.current.size !== 1) return;
    if (!dragging.current) {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => clampOffset({ x: o.x + dx, y: o.y + dy }, scale));
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    // Lifting one finger of a pinch must not make the other one jump the
    // photo: its next move starts a fresh drag from where it is (see above).
    dragging.current = false;
    lastPinchDist.current = null;
  };

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
      // Never below 1: smaller than the frame would leave empty space.
      setScale(s => Math.min(4, Math.max(1, +(s + delta * 0.005).toFixed(3))));
    }
    lastPinchDist.current = dist;
  };
  const onTouchEnd = () => { lastPinchDist.current = null; };

  const handleSave = async () => {
    setUploading(true);
    setUploadError('');
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
      if (!container) { onSaved(imageUrl); return imageUrl; }
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
        const { file_url } = await uploadPublicFile(file);
        onSaved(file_url);
        return file_url;
      }
      throw new Error('Could not make the cropped picture');
    } catch (err) {
      // Stay in the editor: saving the local preview URL instead (as before)
      // left a photo that only ever worked on this device, in this tab.
      console.error('Crop/upload failed:', err);
      setUploadError("Couldn't save the photo. Please try again.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Hand the parent the latest save function (it reads scale/offset).
  useEffect(() => {
    if (!commitRef) return;
    commitRef.current = handleSave;
    return () => { commitRef.current = null; };
  });

  const handleChange = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    // iPhone (HEIC) photos become JPEGs first (heicConvert.js).
    let file;
    try { file = await heicToJpeg(picked); } catch (err) { console.error(err); toast({ variant: 'destructive', ...HEIC_FAILED_MESSAGE }); return; }
    const url = URL.createObjectURL(file);
    // onDiscard is reused here to signal "load new image into editor"
    onDiscard(url);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Crop frame */}
      <div className="flex items-center gap-2">
        <div
          ref={containerRef}
          className={`relative overflow-hidden rounded-2xl bg-[#ECE9E1] select-none flex-shrink-0 ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ width: size, height: size, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
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
          {/* Replace on the photo itself, so the page's own button below has room */}
          {commitRef && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-3 right-3 h-9 px-3 flex items-center gap-1.5 bg-[#F4F2EC]/90 text-[#262624] text-sm font-medium rounded-xl shadow-sm hover:bg-[#F4F2EC] active:scale-[0.97] transition-all disabled:opacity-50"
            >
              <ImageIcon size={16} />
              Replace
            </button>
          )}
        </div>
      </div>

      {/* Zoom — desktop only (touch uses pinch). Same slider as the rest of the product. */}
      {!isTouch && (
        <div style={{ width: size }}>
          <MinimalSlider dark={false} min={1} max={3} step={0.01} value={scale} onChange={setScale} resetValue={1} ariaLabel="Zoom" />
        </div>
      )}

{/* An upload error takes the hint's place, so it stays in view above a pinned page button */}
      {uploadError ? (
        <p className="text-xs text-red-500">{uploadError}</p>
      ) : (
        <p className="text-xs text-[#8A877F]">
          {isTouch
            ? 'Pinch to zoom, then drag to reposition'
            : 'Use the slider to zoom, then drag to reposition'}
        </p>
      )}

      {/* Actions: Replace (text) · Discard (emoji) · Save (check, primary) */}
      {!commitRef && (
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
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}