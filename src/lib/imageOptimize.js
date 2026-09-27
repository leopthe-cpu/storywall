// Client-side image downscale + re-encode before upload, plus a timeout
// helper so a stalled network call never leaves the UI stuck forever.
//
// Why this exists: story media was being uploaded completely untouched —
// a raw phone-camera photo (often 3000-4000px, several MB, sometimes HEIC)
// went straight to storage, then every place that renders it (editor
// canvas, card gallery, published profile) downloaded that same full-size
// original just to show it at a few hundred CSS pixels. That's slow to
// upload, slow to render, and is why cards visibly "pop in" after the rest
// of the page has already loaded. Downscaling once, client-side, before
// upload fixes upload time and render time together since there's only
// ever one (now much smaller) variant to move around.

const MAX_DIMENSION = 1600; // long edge, px — generous headroom over the
// app's 600x600 reference card canvas plus in-editor zoom/crop, still well
// above typical on-screen display size even at high device pixel ratios.
const JPEG_QUALITY = 0.82;
const SKIP_IF_UNDER_BYTES = 700 * 1024; // already-small files aren't worth touching

// Downscales + re-encodes an image File for upload. Returns the original
// file unchanged for non-images, GIFs (canvas would flatten the animation
// to one frame), already-small files, or if anything goes wrong — this is
// always a best-effort optimization, never a hard requirement to upload.
export async function optimizeImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;
  if (file.size <= SKIP_IF_UNDER_BYTES) return file;

  let bitmap = null;
  let objectUrl = null;
  try {
    let width, height, drawSource;
    try {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
    } catch {
      // Fallback for files/browsers createImageBitmap can't handle.
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
      drawSource = img;
    }
    if (!width || !height) return file;

    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_DIMENSION) {
      // Already a reasonable size — leave it alone, quality over byte-shaving here.
      return file;
    }

    const scale = MAX_DIMENSION / longEdge;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file; // never "optimize" into something bigger

    const baseName = (file.name || 'photo').replace(/\.[^./\\]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (e) {
    console.error('[imageOptimize] failed, uploading original file instead', e);
    return file;
  } finally {
    if (bitmap?.close) bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// Races a promise against a timeout so a stalled network request (upload
// hung, connection dropped mid-request with no error ever firing) can't
// leave the caller's loading state stuck forever with no way out for the
// user. The underlying promise isn't cancelled — it may still resolve in
// the background — but the caller is freed to show an error and let the
// user retry instead of staring at a spinner indefinitely.
export function withTimeout(promise, ms, message = 'Timed out') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
