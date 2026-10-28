// iPhone photos are often HEIC/HEIF. Only Safari can show them: picked on a
// computer in Chrome or Firefox (or on Android), a HEIC file uploaded as is
// stays a broken picture in the builder and on the wall, for everyone not on
// Safari (Oz, 2026-10-28). So every photo picker turns HEIC into a JPEG
// before anything else happens (preview, downscale, upload).
//
// The browser's own decoder is tried first (Safari, at no download cost);
// otherwise the heic-to library (libheif, LGPL-3.0) is loaded, only at that
// moment. Its "csp" build is used: our Content-Security-Policy forbids eval
// (Caddyfile), and that build's decoder is plain JavaScript that runs in a
// blob: worker, which the policy allows.

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
const JPEG_QUALITY = 0.9; // imageOptimize re-encodes big photos afterwards

// The toast every picker shows when a HEIC photo can't be converted.
export const HEIC_FAILED_MESSAGE = {
  title: "Couldn't open this photo",
  description: 'This iPhone photo (HEIC) could not be converted. Try saving it as a JPEG first.',
};

// HEIC by type, by name, or (browsers often leave the type empty for these)
// by the brand in the file's header: bytes 4-8 are "ftyp", 8-12 the brand.
export async function isHeicFile(file) {
  if (!file) return false;
  if (HEIC_TYPES.includes((file.type || '').toLowerCase())) return true;
  if (/\.(heic|heif)$/i.test(file.name || '')) return true;
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') return false;
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const text = String.fromCharCode(...head);
    return text.slice(4, 8) === 'ftyp' && HEIC_BRANDS.includes(text.slice(8, 12));
  } catch {
    return false;
  }
}

async function decodeNatively(file) {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    } finally {
      bitmap.close?.();
    }
  } catch {
    return null;
  }
}

// The file itself when it isn't HEIC; otherwise a JPEG File with the same
// name (.jpg). Throws if a HEIC file can't be converted, so callers can say
// so instead of uploading a picture most people can't see.
export async function heicToJpeg(file) {
  if (!(await isHeicFile(file))) return file;
  let blob = await decodeNatively(file);
  if (!blob) {
    try {
      const { heicTo } = await import('heic-to/csp');
      blob = await heicTo({ blob: file, type: 'image/jpeg', quality: JPEG_QUALITY });
    } catch (e) {
      console.error('[heicConvert]', e);
      blob = null;
    }
  }
  if (!blob) throw new Error('Could not convert this HEIC photo');
  const baseName = (file.name || 'photo').replace(/\.[^./\\]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
