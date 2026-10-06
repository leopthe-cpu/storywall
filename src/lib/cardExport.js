// Helpers for exporting story cards as image files (admin-only today,
// planned premium feature). Rendering lives in DownloadCardsButton.jsx;
// this file only packages and saves the resulting blobs.

// Square output size for exported cards. 1080px matches common social
// post sizes (Instagram/LinkedIn square) and gives the website hero sharp
// cards on high-density screens.
export const EXPORT_SIZE = 1080;

export function slugify(text) {
  const slug = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'story';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: Safari can cancel the download if the URL is revoked
  // synchronously after click().
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Phones get the native share sheet ("Save N images" → Photos), which is
// far more useful there than a zip. Desktop (fine pointer) always gets a
// zip, even where the share sheet exists (e.g. macOS Safari).
function shouldUseShareSheet(files) {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    return Boolean(coarse && navigator.canShare?.({ files }));
  } catch {
    return false;
  }
}

// blobs: Blob[] (PNG), in card order.
export async function saveCardImages(blobs, title) {
  const base = `storywall-${slugify(title)}`;
  const names = blobs.map((_, i) => `${base}-${String(i + 1).padStart(2, '0')}.png`);

  if (blobs.length === 1) {
    triggerDownload(blobs[0], names[0]);
    return 'download';
  }

  const files = blobs.map((b, i) => new File([b], names[i], { type: 'image/png' }));
  if (shouldUseShareSheet(files)) {
    try {
      await navigator.share({ files, title: title || 'StoryWall cards' });
      return 'share';
    } catch (e) {
      // User closed the sheet — not an error, and don't fall through to a
      // surprise zip download.
      if (e?.name === 'AbortError') return 'cancelled';
      // Any other share failure: fall back to the zip below.
    }
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(names[i], b));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `${base}-cards.zip`);
  return 'zip';
}
