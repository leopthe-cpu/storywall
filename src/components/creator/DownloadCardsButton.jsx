import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';
import CardThumb from '@/components/creator/CardThumb';
import { EXPORT_SIZE, saveCardImages } from '@/lib/cardExport';

// "Download all cards as images" — admin-only for now (planned premium
// feature). The caller decides visibility; this renders nothing about who
// may use it. It's a purely client-side render of cards the viewer can
// already see, so there's nothing to protect server-side.
//
// How it works: while exporting, every card is rendered once more through
// CardThumb (the same renderer as the preview and the published card, so
// the export matches what people see) at EXPORT_SIZE in a hidden layer,
// then each node is rasterised with html-to-image (SVG foreignObject — the
// browser itself paints the card, so object-fit crops, transforms and text
// effects come out right, unlike html2canvas).
//
// Known limits: a "Blur" photo overlay (backdrop-filter) is not captured;
// video shows its current frame; images whose host doesn't allow CORS
// can't be embedded — those are detected up front and reported.

// Wait until every <img> in the node has loaded (or failed).
async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    // CardThumb lazy-loads; the hidden layer may count as off-screen.
    img.loading = 'eager';
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 15_000);
    });
  }));
}

// Images that never resolved (e.g. a private draft photo whose signed URL
// hasn't arrived, or a broken link) make html-to-image fail with a bare
// error Event and no explanation — catch them first.
function countUnloadedImages(node) {
  return Array.from(node.querySelectorAll('img'))
    .filter((img) => !img.getAttribute('src') || !img.complete || img.naturalWidth === 0).length;
}

// html-to-image re-downloads every image with fetch() to inline it, which
// needs CORS. If that fails it silently leaves a blank hole, so check first
// and tell the user instead of handing them broken cards.
async function findUnfetchableImages(node) {
  const urls = [...new Set(Array.from(node.querySelectorAll('img')).map((i) => i.currentSrc || i.src).filter((u) => u && !u.startsWith('data:') && !u.startsWith('blob:')))];
  const results = await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { mode: 'cors', cache: 'no-store' });
      return res.ok ? null : u;
    } catch {
      return u;
    }
  }));
  return results.filter(Boolean);
}

export default function DownloadCardsButton({ cards, tokens, title, className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | rendering | error
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const layerRef = useRef(null);
  const runRef = useRef(false);
  // Read through a ref so typing in the title field mid-export doesn't
  // restart (and strand) the running export.
  const titleRef = useRef(title);
  titleRef.current = title;

  const exportable = (cards || []).filter(Boolean);

  useEffect(() => {
    if (status !== 'rendering' || runRef.current) return;
    runRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        // Let React paint the hidden layer before measuring anything.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const layer = layerRef.current;
        if (!layer) throw new Error('Export layer did not mount');

        await document.fonts?.ready;
        await waitForImages(layer);

        const unloaded = countUnloadedImages(layer);
        if (unloaded) {
          throw new Error(`${unloaded} image${unloaded > 1 ? 's' : ''} didn't load. Wait a moment and try again.`);
        }

        const blocked = await findUnfetchableImages(layer);
        if (blocked.length) {
          console.warn('[DownloadCardsButton] images not fetchable with CORS:', blocked);
          throw new Error(`${blocked.length} image${blocked.length > 1 ? 's' : ''} couldn't be included (the file host blocked it). Nothing was downloaded.`);
        }

        const { toBlob, getFontEmbedCSS } = await import('html-to-image');
        const nodes = Array.from(layer.querySelectorAll('[data-export-card]'));
        const options = {
          width: EXPORT_SIZE,
          height: EXPORT_SIZE,
          pixelRatio: 1,
          // Bypass the cache: an image first loaded by a plain <img> can be
          // cached without CORS headers and then fail the CORS re-fetch.
          fetchRequestInit: { cache: 'no-store' },
          // Signed media URLs differ only by query string — keep it in the
          // cache key so two different images don't collide.
          includeQueryParams: true,
        };
        // Embed fonts once and reuse for every card (otherwise each card
        // re-downloads every font file).
        options.fontEmbedCSS = await getFontEmbedCSS(nodes[0], options);

        const blobs = [];
        for (let i = 0; i < nodes.length; i++) {
          if (cancelled) return;
          setProgress(i);
          const blob = await toBlob(nodes[i], options);
          if (!blob) throw new Error(`Card ${i + 1} could not be rendered.`);
          blobs.push(blob);
        }
        if (cancelled) return;
        setProgress(nodes.length);
        await saveCardImages(blobs, titleRef.current);
        setStatus('idle');
      } catch (e) {
        console.error('[DownloadCardsButton] export failed:', e);
        if (!cancelled) {
          // html-to-image rejects with a DOM Event (not an Error) when the
          // browser can't paint the generated image.
          setMessage(e instanceof Error && e.message ? e.message : 'Export failed — a card could not be rendered. Check the console for details.');
          setStatus('error');
        }
      } finally {
        runRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [status]);

  if (!exportable.length) return null;

  const busy = status === 'rendering';
  const label = busy
    ? `Rendering ${Math.min(progress + 1, exportable.length)}/${exportable.length}…`
    : exportable.length === 1 ? 'Download card as image' : `Download all ${exportable.length} cards as images`;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => { setMessage(''); setProgress(0); setStatus('rendering'); }}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
      >
        {busy ? <PixelSpinner size={14} /> : <Download size={16} />}
        <span>{label}</span>
        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Admin</span>
      </button>
      {status === 'error' && message && <p className="mt-2 text-xs text-red-500">{message}</p>}

      {busy && createPortal(
        // Hidden render layer: fixed at the viewport origin (so nothing is
        // treated as off-screen) but invisible and non-interactive. Opacity
        // sits on this wrapper only, so the captured card nodes themselves
        // stay fully opaque.
        <div
          ref={layerRef}
          aria-hidden="true"
          style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden', width: EXPORT_SIZE, height: EXPORT_SIZE }}
        >
          {exportable.map((card, i) => (
            <div
              key={card.id || i}
              data-export-card
              style={{ position: 'absolute', top: 0, left: 0, width: EXPORT_SIZE, height: EXPORT_SIZE }}
            >
              <CardThumb card={card} displaySize={EXPORT_SIZE} tokens={tokens} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
