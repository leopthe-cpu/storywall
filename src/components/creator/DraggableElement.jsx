import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET } from './CanvasArea';
import { Play } from '@/components/icons';
import AudioWidget from './AudioWidget';
import { useDraftMedia } from './DraftMediaContext';
import { resolveColor } from '@/lib/colorTokens';
import { getTextEffectStyle, hasTextWarp } from '@/lib/textEffects';
import { getTextBoxLayout } from '@/lib/textLayout';
import WarpedText from './WarpedText';
import ImageSkeleton from '@/components/ui/ImageSkeleton';
import PixelSpinner from '@/components/ui/PixelSpinner';

function buildOverlayStyle(element) {
  const { overlay_type, overlay_position, overlay_intensity, overlay_color } = element;
  if (!overlay_type || overlay_type === 'None') return null;
  const intensity = (overlay_intensity ?? 50) / 100;
  const dir = ({ Bottom: 'to top', Top: 'to bottom', Left: 'to right', Right: 'to left' })[overlay_position || 'Bottom'] || 'to top';

  if (overlay_type === 'Dark') {
    return { background: `linear-gradient(${dir}, rgba(0,0,0,${intensity}) 0%, transparent 100%)` };
  }
  if (overlay_type === 'Color') {
    const hex = overlay_color || '#000000';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { background: `linear-gradient(${dir}, rgba(${r},${g},${b},${intensity}) 0%, transparent 100%)` };
  }
  return null;
}

// Corner handles (blue circles) resize the display box (displayWidth/Height).
// Edge handles (green pills) crop (clipTop/Bottom/Left/Right). The two sets
// operate on independent properties and never reset each other.
const CORNER_HANDLES = [
  { id: 'nw', cursor: 'nwse-resize' },
  { id: 'ne', cursor: 'nesw-resize' },
  { id: 'sw', cursor: 'nesw-resize' },
  { id: 'se', cursor: 'nwse-resize' },
];
const EDGE_HANDLES = [
  { id: 'n', cursor: 'ns-resize' },
  { id: 's', cursor: 'ns-resize' },
  { id: 'e', cursor: 'ew-resize' },
  { id: 'w', cursor: 'ew-resize' },
];

// Smart-guide center-snap threshold, in real screen px (not reference-card
// px), so it feels consistent regardless of zoom/card size.
const CENTER_SNAP_PX = 6;

// Handles are positioned so their CENTER lands exactly on the true corner
// (half in, half out) — not flush against it. Flush positioning was shifting
// every handle a full half-size inward from the point it's supposed to sit
// on, which is most of what read as "the selection points are off", and on
// small/zoomed-out cards it also let adjacent handles overlap and steal each
// other's drags. The anchor (left/top/right/bottom) + transform combo below
// centers the handle regardless of its own width/height, so the actual
// click/touch target can be sized generously for mobile without ever having
// to recompute an offset by hand.
function cornerStyle(id) {
  const map = {
    nw: { left: 0, top: 0, transform: 'translate(-50%, -50%)' },
    ne: { right: 0, top: 0, transform: 'translate(50%, -50%)' },
    sw: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' },
    se: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' },
  };
  return map[id];
}

// Handle positions for an image/video box, in the box's own local screen px.
// Each handle sits on its true corner / edge midpoint, EXCEPT that it's pulled
// back inside the card whenever that point falls outside it. The card clips
// with overflow:hidden, so a picture bigger than the frame used to have its
// handles cut off and unreachable — now they always ride the card's edge, so
// you can still grab and resize a picture that's larger than the frame. Edge
// (crop) handles sit at the middle of the part of their edge that's actually
// on the card.
function imageHandlePositions({ left, top, width, height, sf }) {
  const C = REFERENCE_CARD_SIZE;
  const m = 10 / sf; // keep handle centres ~10 screen px inside the card
  const clampToCard = (v) => Math.min(C - m, Math.max(m, v));
  const visibleMid = (a, b) => (Math.max(a, 0) + Math.min(b, C)) / 2;
  const L = left, T = top, R = left + width, B = top + height;
  const points = {
    nw: [L, T], ne: [R, T], sw: [L, B], se: [R, B],
    n: [visibleMid(L, R), T], s: [visibleMid(L, R), B],
    w: [L, visibleMid(T, B)], e: [R, visibleMid(T, B)],
  };
  const out = {};
  for (const [id, [x, y]] of Object.entries(points)) {
    out[id] = { left: (clampToCard(x) - L) * sf, top: (clampToCard(y) - T) * sf, transform: 'translate(-50%, -50%)' };
  }
  return out;
}

// Edge/midpoint ("trim") handles — same centering idea, applied along the
// axis perpendicular to the edge (the axis running along the edge was
// already centered via left/top: 50%, unchanged).
function edgeStyle(id) {
  const map = {
    n: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' },
    s: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' },
    w: { top: '50%', left: 0, transform: 'translate(-50%, -50%)' },
    e: { top: '50%', right: 0, transform: 'translate(50%, -50%)' },
  };
  return map[id];
}

const isImageLike = (t) => t === 'image' || t === 'video';

// Content-aware font sizing: compute a starting font size based on the
// actual available room in the text box and how much text it holds.
// Uses an area-based estimate — the shrink safety net corrects any
// discrepancy after render.
function computeEstimatedFontSize(content, displayWidth, availableHeight) {
  if (!content || !content.trim()) return null;
  const availableWidth = (displayWidth && displayWidth > 0 ? displayWidth : REFERENCE_CARD_SIZE * 0.8) - 4;
  const availH = (availableHeight && availableHeight > 0 ? availableHeight : REFERENCE_CARD_SIZE * 0.6) - 4;
  if (availableWidth <= 0 || availH <= 0) return null;
  const charWidthFactor = 0.55;
  const lineHeightFactor = 1.2;
  const boxArea = availableWidth * availH;
  const estimated = Math.round(Math.sqrt(boxArea / (content.length * charWidthFactor * lineHeightFactor)));
  return Math.max(8, Math.min(128, estimated));
}

export default function DraggableElement({ element, scale = 1, isSelected, onSelect, onUpdate, canvasBounds, cardSize, autoEdit, onAutoEditConsumed, cardBg, onDragStateChange, onCenterGuideChange, availableHeight, tokens, isHovered, onHover }) {
  const elRef = useRef(null);
  const contentRef = useRef(null);
  // Lazy-init: when this element mounts already flagged for auto-edit (a
  // freshly-created text box), start it in editing/contentEditable mode from
  // the very first render — see the layout effect below for why this matters
  // for the mobile keyboard.
  const [editing, setEditing] = useState(() => !!(autoEdit && element.type === 'text'));
  const [isResizing, setIsResizing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!(element.content && element.content.trim()));
  // Tracks whether the CURRENT image/video src has finished loading, so we
  // can show a spinner placeholder instead of a blank/transparent gap while
  // a new src (e.g. the optimistic preview → final upload swap) is fetching
  // and decoding. Derived directly during render by comparing element.image_url
  // against the last url we actually saw load — not via a useEffect — so
  // there's no extra render pass where the DOM already has the new (not yet
  // loaded) src but the loading flag hasn't caught up yet. An effect-based
  // reset left exactly that one-frame gap: React commits the new <img src>
  // to the DOM (which most browsers blank immediately), the browser paints
  // that blank frame, and only afterward does the effect fire and trigger a
  // second render with the spinner showing.
  const loadedUrlRef = useRef(null);
  const [, setLoadTick] = useState(0);
  const dragStart = useRef(null);
  const lastGuideRef = useRef({ v: false, h: false });
  const prevContentRef = useRef(element.content || '');
  const hasSizedRef = useRef(false);
  // Mirrors of `editing` and the latest onUpdate, readable from the unmount
  // cleanup below (which otherwise only sees the first render's values).
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const { resolveMediaUrl } = useDraftMedia();
  // Resolve once per render and compare loaded-ness against THIS value, not
  // the raw element.image_url. DraftMediaContext can return a different
  // resolved (signed) URL for the same image_url over time — e.g. it first
  // returns '' while a private file_uri is being resolved to a signed URL,
  // then later returns the real URL once resolution completes — all without
  // element.image_url itself ever changing. Comparing against element.image_url
  // would treat that second, real load as already-loaded (since the id never
  // changed) and the spinner would disappear right as the actual image swap
  // happens, leaving exactly the transparent flash this is meant to prevent.
  const resolvedMediaSrc = resolveMediaUrl(element.image_url);
  const mediaLoaded = !!resolvedMediaSrc && loadedUrlRef.current === resolvedMediaSrc;

  // ImageSkeleton's shimmer sweep appears the instant loading starts (that's
  // what closes the transparent-flash gap) and is enough on its own for the
  // common case — most loads (the local blob preview, an already-cached
  // signed URL) resolve in well under a second. But the shimmer alone reads
  // as ambiguous on a genuinely slow load: it's easy to glance at and not be
  // sure anything is still happening. showSpinner is a deliberately delayed
  // fallback on top of it — only once a load has actually been running for
  // 3s+ does the PixelSpinner appear, at which point it's earned its keep as
  // unambiguous "still working" reassurance rather than noise on every load.
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (mediaLoaded) {
      setShowSpinner(false);
      return;
    }
    setShowSpinner(false);
    const timer = setTimeout(() => setShowSpinner(true), 3000);
    return () => clearTimeout(timer);
  }, [resolvedMediaSrc, mediaLoaded]);

  // Keep the empty-placeholder state in sync when content changes externally.
  // Also compute content-aware font size when text is first populated.
  useEffect(() => {
    const isEmpty = !(element.content && element.content.trim());
    if (!editing) setIsEmpty(isEmpty);

    // Content-aware sizing: on first render with content (Generate mode),
    // or when text transitions from empty to non-empty (manual typing).
    // Runs on blur for manual typing, on mount for Generate mode.
    //
    // font_size_estimated persists that this pass has already run, even when
    // the estimate doesn't end up changing anything. Previously only the
    // local hasSizedRef guarded against re-running, and a ref resets on every
    // remount (reopening a saved draft, undo/redo, switching away and back)
    // — so an AI-generated box that was never manually edited (and so never
    // got font_size_locked from handleBlur) would silently re-estimate from
    // scratch on every remount and could land on a different size than what
    // was actually saved, overwriting it. This is a separate flag from
    // font_size_locked (which still means "the user touched this") so it
    // doesn't change what CanvasArea's coordinated multi-textbox shrink
    // treats as "untouched, freshly-generated" text.
    if (!isEmpty && !hasSizedRef.current && !editing) {
      if (!element.font_size_locked && !element.font_size_estimated) {
        const estimated = computeEstimatedFontSize(element.content, element.displayWidth, availableHeight);
        const currentSize = parseInt(element.font_size) || 14;
        const updates = { font_size_estimated: true };
        if (estimated && Math.abs(estimated - currentSize) > 2) {
          updates.font_size = String(estimated);
        }
        onUpdate(updates);
      }
      hasSizedRef.current = true;
    }
    // Reset when content becomes empty so it re-sizes when re-populated
    if (isEmpty) hasSizedRef.current = false;

    prevContentRef.current = element.content || '';
  }, [element.content, editing]);

  // Prevent browser scroll/pull-to-refresh during touch drag
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const prevent = (e) => { if (!editing) e.preventDefault(); };
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
    };
  }, [editing]);

  // Typed text only reaches the story's state when the box blurs (handleBlur)
  // — it's deliberately not written on every keystroke, since re-rendering a
  // contentEditable's children mid-typing jumps the caret. But many ways of
  // "moving on" never blur it, especially on mobile: tapping another element
  // or the canvas (canvas elements preventDefault touchstart, so focus never
  // moves), switching tools, or creating/switching cards (which unmounts the
  // box outright). Anything typed since the last blur was then silently
  // missing from every save. So: commit when the box is deselected while
  // still editing, and as a last resort when it unmounts mid-edit. Reads the
  // live DOM text when available, else the last text handleInput recorded.
  const commitLiveText = () => {
    const node = contentRef.current;
    const text = node ? node.innerText : prevContentRef.current;
    onUpdateRef.current?.({ content: text, font_size_locked: true });
  };
  useEffect(() => {
    if (isSelected || !editing) return;
    const node = contentRef.current;
    if (node && document.activeElement === node) {
      node.blur(); // → handleBlur commits content + lock and exits editing
    } else {
      commitLiveText();
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, editing]);
  useEffect(() => () => {
    if (editingRef.current) commitLiveText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus a newly added text element so the user can type immediately.
  // This must be a *synchronous* layout effect with no setTimeout/rAF: on
  // mobile Safari/Chrome, calling .focus() only opens the native keyboard
  // when it happens as a direct continuation of the user's tap (the "user
  // activation" window). A useEffect (which runs after paint) or any delay
  // inside it lands outside that window, so focus() still succeeds visually
  // but the keyboard never appears. useLayoutEffect runs synchronously right
  // after the DOM commit, before the browser paints, which stays inside that
  // window. `editing` is already true from mount (see the lazy useState
  // above) so contentEditable is already set on this very first commit —
  // no second render needs to land before we can focus it.
  useLayoutEffect(() => {
    if (autoEdit && element.type === 'text') {
      const node = elRef.current?.querySelector('[contenteditable="true"]');
      if (node) {
        node.focus();
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      onAutoEditConsumed?.();
    }
    // Fires once, at mount: autoEditId is only ever set at the moment a new
    // text element is created (see StoryCreator.jsx's addElement), and this
    // component is freshly keyed by element.id, so it never re-fires later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve display dimensions in reference px (with migration fallback for
  // older elements that only stored width/height as percentages).
  const getDisplayDims = () => {
    const refSize = REFERENCE_CARD_SIZE;
    const cropRatio = element.crop_ratio || 'fill';
    if (element.displayWidth != null) {
      return { displayWidth: element.displayWidth, displayHeight: element.displayHeight ?? element.displayWidth };
    }
    const dw = ((element.width ?? 80) / 100) * refSize;
    const ratioParts = (cropRatio !== 'original' && cropRatio !== 'fill') ? cropRatio.split('/').map(Number) : null;
    const aspect = ratioParts && ratioParts[0] && ratioParts[1] ? ratioParts[0] / ratioParts[1] : null;
    const dh = element.height != null ? ((element.height) / 100) * refSize : (aspect ? dw / aspect : dw);
    return { displayWidth: dw, displayHeight: dh };
  };

  // ── Move (drag body) — changes position (x/y) ──
  const handlePointerDown = (e) => {
    if (editing) return;
    e.stopPropagation();

    onSelect();

    const canvas = canvasBounds.current?.getBoundingClientRect();
    if (!canvas) return;

    const elRect = elRef.current?.getBoundingClientRect();

    dragStart.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x ?? 0,
      origY: element.y ?? 0,
      width: elRect ? elRect.width : 0,
      height: elRect ? elRect.height : 0,
      startTime: Date.now(),
      moved: false,
    };

    const handleEl = e.currentTarget;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}

    const onMove = (ev) => {
      const clientX = ev.touches?.[0]?.clientX ?? ev.clientX;
      const clientY = ev.touches?.[0]?.clientY ?? ev.clientY;
      if (!dragStart.current.moved) {
        if (Math.abs(clientX - dragStart.current.startX) < 8 && Math.abs(clientY - dragStart.current.startY) < 8) return;
        dragStart.current.moved = true;
        onDragStateChange?.(true);
      }
      const dx = ((clientX - dragStart.current.startX) / canvas.width) * 100;
      const dy = ((clientY - dragStart.current.startY) / canvas.height) * 100;

      const widthPct = (dragStart.current.width / canvas.width) * 100;
      const heightPct = (dragStart.current.height / canvas.height) * 100;

      // Pictures may hang off the card on any side (e.g. a photo scaled bigger
      // than the frame, dragged to show a different part of it) — they only
      // need a 10% sliver left on the card so they can be grabbed again. The
      // old 0–90% clamp stopped a picture's top/left edge at the card's edge,
      // so you could drag it down/right but never up/left. Text and audio
      // keep the original range.
      const imageLike = isImageLike(element.type);
      const minX = imageLike ? Math.min(0, 10 - widthPct) : 0;
      const minY = imageLike ? Math.min(0, 10 - heightPct) : 0;
      let newX = Math.max(minX, Math.min(90, dragStart.current.origX + dx));
      let newY = Math.max(minY, Math.min(90, dragStart.current.origY + dy));

      // Smart guides — snap to the card's center when this element's own
      // center comes within CENTER_SNAP_PX (screen px) of it, and report which
      // guide line(s) to show. Threshold is screen-px based so it feels the
      // same regardless of zoom/card size.
      const snapXPct = (CENTER_SNAP_PX / canvas.width) * 100;
      const snapYPct = (CENTER_SNAP_PX / canvas.height) * 100;
      const snapV = Math.abs((newX + widthPct / 2) - 50) < snapXPct;
      const snapH = Math.abs((newY + heightPct / 2) - 50) < snapYPct;
      if (snapV) newX = 50 - widthPct / 2;
      if (snapH) newY = 50 - heightPct / 2;

      if (snapV !== lastGuideRef.current.v || snapH !== lastGuideRef.current.h) {
        lastGuideRef.current = { v: snapV, h: snapH };
        onCenterGuideChange?.({ v: snapV, h: snapH });
      }

      onUpdate({ x: newX, y: newY });
    };

    const onUp = () => {
      try { handleEl.releasePointerCapture(e.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragStart.current.moved) onDragStateChange?.(false);
      if (lastGuideRef.current.v || lastGuideRef.current.h) {
        lastGuideRef.current = { v: false, h: false };
        onCenterGuideChange?.({ v: false, h: false });
      }
      // Tap detection: if pointer didn't move beyond the 8px threshold and was
      // released within 300ms, treat as a tap → enter edit mode for text elements.
      // This makes single-tap-to-edit work on touch (double-tap is unreliable).
      if (!dragStart.current.moved && element.type === 'text' && Date.now() - dragStart.current.startTime < 300) {
        setEditing(true);
        setTimeout(() => {
          const node = elRef.current?.querySelector('[contenteditable="true"]');
          if (node) {
            node.focus();
            const range = document.createRange();
            range.selectNodeContents(node);
            range.collapse(false); // cursor at end
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 60);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Resize (corner handles) — changes displayWidth/displayHeight only ──
  const startResize = (e, handleId, aspectLocked) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onDragStateChange?.(true);
    const sf = scale;
    const { displayWidth: origW, displayHeight: origH } = getDisplayDims();
    // Aspect-locked corners keep the box's CURRENT shape. This used to switch
    // to the photo's natural aspect (for 'original'/'fill') or the preset's
    // ratio, so a box that wasn't already that exact shape (e.g. after Fit to
    // card squared it) visibly jumped to a different shape on the first drag.
    const aspect = origH > 0 ? origW / origH : 1;
    // Crop insets are stored as absolute reference-px offsets into this
    // full (uncropped) image box. If resize left them untouched, an existing
    // crop would visibly drift/distort every time the box is resized
    // afterward. Scaling all four insets by the same factor the box itself
    // scales by keeps the crop's framing exactly as it was.
    const origClipTop = element.clipTop || 0, origClipBottom = element.clipBottom || 0;
    const origClipLeft = element.clipLeft || 0, origClipRight = element.clipRight || 0;
    const isLeft = handleId.includes('w');
    const isTop = handleId.includes('n');
    const startX = e.clientX;
    const startY = e.clientY;

    // The opposite corner, in screen coordinates, held fixed for the whole
    // gesture. When the resize is aspect-locked (always true for images),
    // this lets the drag be measured as a true diagonal distance from that
    // fixed point instead of only the horizontal delta — previously a
    // diagonal drag that moved mostly vertically did nothing at all, which
    // is what read as "it only drags by moving in one direction".
    const rect = elRef.current?.getBoundingClientRect();
    const fixed = rect ? {
      x: isLeft ? rect.right : rect.left,
      y: isTop ? rect.bottom : rect.top,
    } : { x: startX, y: startY };
    const oldDiag = Math.hypot(startX - fixed.x, startY - fixed.y) || 1;

    // The corner opposite the dragged handle must stay put (Figma/Canva
    // behaviour). x/y used to never change here, so every corner acted like
    // the bottom-right one: dragging the top-left handle up-left grew the
    // picture down-right, away from your finger. Tracked in reference px on
    // the visible (post-crop) box, which is what x/y position.
    const origLeftRef = ((element.x ?? 0) / 100) * REFERENCE_CARD_SIZE;
    const origTopRef = ((element.y ?? 0) / 100) * REFERENCE_CARD_SIZE;
    const anchorRightRef = origLeftRef + (origW - origClipLeft - origClipRight);
    const anchorBottomRef = origTopRef + (origH - origClipTop - origClipBottom);

    const handleEl = e.currentTarget;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}

    const onMove = (ev) => {
      const dxRef = (ev.clientX - startX) / sf;
      const dyRef = (ev.clientY - startY) / sf;
      const dW = isLeft ? -dxRef : dxRef;
      const dH = isTop ? -dyRef : dyRef;

      let newW;
      const updates = {};
      if (aspectLocked) {
        const newDiag = Math.hypot(ev.clientX - fixed.x, ev.clientY - fixed.y);
        newW = Math.max(40, origW * (newDiag / oldDiag));
        updates.displayWidth = Math.round(newW);
        updates.displayHeight = Math.round(newW / aspect);
      } else {
        newW = Math.max(40, origW + dW);
        updates.displayWidth = Math.round(newW);
        updates.displayHeight = Math.round(Math.max(40, origH + dH));
      }
      const scaleFactor = origW > 0 ? newW / origW : 1;
      if (origClipTop || origClipBottom || origClipLeft || origClipRight) {
        updates.clipTop = Math.round(origClipTop * scaleFactor);
        updates.clipBottom = Math.round(origClipBottom * scaleFactor);
        updates.clipLeft = Math.round(origClipLeft * scaleFactor);
        updates.clipRight = Math.round(origClipRight * scaleFactor);
      }
      const newVisW = updates.displayWidth - (updates.clipLeft || 0) - (updates.clipRight || 0);
      const newVisH = updates.displayHeight - (updates.clipTop || 0) - (updates.clipBottom || 0);
      if (isLeft) updates.x = Math.round(((anchorRightRef - newVisW) / REFERENCE_CARD_SIZE) * 10000) / 100;
      if (isTop) updates.y = Math.round(((anchorBottomRef - newVisH) / REFERENCE_CARD_SIZE) * 10000) / 100;
      onUpdate(updates);
    };

    const onUp = (ev) => {
      try { handleEl.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDragStateChange?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Crop (edge handles) — changes clip values only, never size/position ──
  const startCrop = (e, handleId) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onDragStateChange?.(true);
    const sf = scale;
    const { displayWidth: dW, displayHeight: dH } = getDisplayDims();
    const orig = {
      clipTop: element.clipTop || 0,
      clipBottom: element.clipBottom || 0,
      clipLeft: element.clipLeft || 0,
      clipRight: element.clipRight || 0,
      x: element.x ?? 0,
      y: element.y ?? 0,
    };
    const startX = e.clientX;
    const startY = e.clientY;
    const handleEl = e.currentTarget;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}

    const onMove = (ev) => {
      const dxRef = (ev.clientX - startX) / sf;
      const dyRef = (ev.clientY - startY) / sf;
      let { clipTop, clipBottom, clipLeft, clipRight } = orig;
      let newX = orig.x, newY = orig.y;

      // 'n' moves the top edge: increase clipTop, shift y down so the bottom stays fixed
      if (handleId === 'n') {
        clipTop = Math.max(0, Math.min(dH - orig.clipBottom - 20, orig.clipTop + dyRef));
        newY = orig.y + (clipTop - orig.clipTop) / REFERENCE_CARD_SIZE * 100;
      }
      // 's' moves the bottom edge: top stays fixed (already correct)
      if (handleId === 's') {
        clipBottom = Math.max(0, Math.min(dH - orig.clipTop - 20, orig.clipBottom - dyRef));
      }
      // 'e' moves the right edge: left stays fixed (already correct)
      if (handleId === 'e') {
        clipRight = Math.max(0, Math.min(dW - orig.clipLeft - 20, orig.clipRight - dxRef));
      }
      // 'w' moves the left edge: increase clipLeft, shift x right so the right stays fixed
      if (handleId === 'w') {
        clipLeft = Math.max(0, Math.min(dW - orig.clipRight - 20, orig.clipLeft + dxRef));
        newX = orig.x + (clipLeft - orig.clipLeft) / REFERENCE_CARD_SIZE * 100;
      }

      const updates = {
        clipTop: Math.round(clipTop),
        clipBottom: Math.round(clipBottom),
        clipLeft: Math.round(clipLeft),
        clipRight: Math.round(clipRight),
      };
      if (handleId === 'n') updates.y = Math.round(newY * 10) / 10;
      if (handleId === 'w') updates.x = Math.round(newX * 10) / 10;
      onUpdate(updates);
    };

    const onUp = (ev) => {
      try { handleEl.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDragStateChange?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (element.type === 'text') setEditing(true);
  };

  // Safe-zone caps for text elements — the full safe zone in both dimensions.
  // Position adjustment (moving the box to stay within bounds when it grows)
  // is handled in handleInput and the render, so the box can grow symmetrically
  // on all sides rather than being limited by its current position.
  const safeZoneSize = REFERENCE_CARD_SIZE - 2 * SAFE_ZONE_INSET;
  const maxTextWidth = safeZoneSize;
  const maxTextHeight = safeZoneSize;

  const handleInput = (e) => {
    const node = e.target;
    const currentWidth = element.displayWidth || (REFERENCE_CARD_SIZE * 0.8);
    const currentHeight = element.displayHeight || 0;
    const updates = {};

    // Auto-grow width if text overflows horizontally (unclamped — visual
    // clamping is done in the render; this saves the real desired width)
    if (node.scrollWidth > node.clientWidth) {
      updates.displayWidth = Math.round(Math.max(node.scrollWidth / scale + 4, currentWidth + 10));
    }

    // Vertical room. An auto-height box grows downward with its text until it
    // reaches the bottom of the card's safe zone; a box the user gave a fixed
    // height keeps that height. When the text no longer fits, the FONT shrinks
    // to the largest size that fits (min 8) instead of the box jumping up the
    // card. This only ever runs while typing (onInput) — once the user stops
    // or taps away, size and position are left exactly as they are.
    const padPx = Math.round(2 * scale);
    const boxTopRef = Math.max(SAFE_ZONE_INSET, ((element.y ?? 20) / 100) * REFERENCE_CARD_SIZE);
    const roomRef = currentHeight > 0
      ? Math.min(currentHeight, safeZoneSize)
      : Math.max(20, (REFERENCE_CARD_SIZE - SAFE_ZONE_INSET) - boxTopRef);
    const roomPx = roomRef * scale - padPx * 2;
    if (node.scrollHeight > roomPx + 1) {
      const MIN_TYPING_FONT = 8;
      const baseSize = parseInt(element.font_size) || 14;
      // Measure candidate sizes directly on the live node (restored after),
      // so the result accounts for real wrapping, font and effects.
      const saved = { fontSize: node.style.fontSize, lineHeight: node.style.lineHeight, minHeight: node.style.minHeight, height: node.style.height };
      node.style.minHeight = '0px';
      node.style.height = 'auto';
      const fits = (fs) => {
        node.style.fontSize = `${fs * scale}px`;
        node.style.lineHeight = fs >= 32 ? '1.05' : '1.3';
        return node.scrollHeight <= roomPx + 1;
      };
      let lo = MIN_TYPING_FONT, hi = baseSize - 1, best = null;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      Object.assign(node.style, saved);
      if (best) {
        updates.font_size = String(best);
      } else {
        // Doesn't fit even at the minimum size — refuse the last keystroke.
        node.innerText = prevContentRef.current;
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }

    // Adjust x leftward if the new width would exceed the right safe zone
    if (updates.displayWidth) {
      const elLeftPx = ((element.x ?? 16) / 100) * REFERENCE_CARD_SIZE;
      if (elLeftPx + updates.displayWidth > REFERENCE_CARD_SIZE - SAFE_ZONE_INSET) {
        const newLeft = Math.max(SAFE_ZONE_INSET, REFERENCE_CARD_SIZE - SAFE_ZONE_INSET - updates.displayWidth);
        updates.x = (newLeft / REFERENCE_CARD_SIZE) * 100;
      }
    }

    if (Object.keys(updates).length) onUpdate(updates);

    prevContentRef.current = node.innerText;
    setIsEmpty(!node.innerText.trim());
  };

  // Text corner resize — changes width AND height proportionally (maintains
  // aspect ratio). The opposite corner stays fixed. Font size NEVER changes
  // as a side effect of resize — only the dedicated font size control changes it.
  const startTextResize = (e, handleId) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onDragStateChange?.(true);
    setIsResizing(true);
    const sf = scale;
    const origW = element.displayWidth || (REFERENCE_CARD_SIZE * 0.8);
    const origH = element.displayHeight || 0;

    // For auto-height boxes, measure the current rendered height to establish
    // an aspect ratio for proportional corner resize.
    let effectiveH = origH;
    if (origH === 0 && contentRef.current) {
      effectiveH = Math.round((contentRef.current.scrollHeight + Math.round(2 * sf) * 2) / sf);
    }
    const aspect = effectiveH > 0 ? origW / effectiveH : 1;

    // Opposite (fixed) corner and dragged corner start, in reference px
    const origXpx = ((element.x ?? 16) / 100) * REFERENCE_CARD_SIZE;
    const origYpx = ((element.y ?? 20) / 100) * REFERENCE_CARD_SIZE;
    const fixed = {
      nw: { x: origXpx + origW, y: origYpx + effectiveH },
      ne: { x: origXpx, y: origYpx + effectiveH },
      sw: { x: origXpx + origW, y: origYpx },
      se: { x: origXpx, y: origYpx },
    }[handleId];
    const draggedStart = {
      nw: { x: origXpx, y: origYpx },
      ne: { x: origXpx + origW, y: origYpx },
      sw: { x: origXpx, y: origYpx + effectiveH },
      se: { x: origXpx + origW, y: origYpx },
    }[handleId];
    const oldDiag = Math.hypot(draggedStart.x - fixed.x, draggedStart.y - fixed.y);

    const canvas = canvasBounds.current?.getBoundingClientRect();
    if (!canvas) return;
    const handleEl = e.currentTarget;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}

    const cardMax = REFERENCE_CARD_SIZE - SAFE_ZONE_INSET;

    const onMove = (ev) => {
      const fx = (ev.clientX - canvas.left) / sf;
      const fy = (ev.clientY - canvas.top) / sf;
      const newDiag = Math.hypot(fx - fixed.x, fy - fixed.y);
      const s = oldDiag > 0 ? newDiag / oldDiag : 1;
      let newW = Math.max(60, origW * s);
      let newH = newW / aspect;

      // Clamp to card safe zone
      newW = Math.min(newW, cardMax);
      newH = Math.min(newH, cardMax);

      // Compute new position to keep the fixed corner in place
      let newXpx, newYpx;
      if (handleId === 'nw') { newXpx = fixed.x - newW; newYpx = fixed.y - newH; }
      if (handleId === 'ne') { newXpx = fixed.x; newYpx = fixed.y - newH; }
      if (handleId === 'sw') { newXpx = fixed.x - newW; newYpx = fixed.y; }
      if (handleId === 'se') { newXpx = fixed.x; newYpx = fixed.y; }

      // Clamp position to safe zone
      newXpx = Math.max(SAFE_ZONE_INSET, Math.min(REFERENCE_CARD_SIZE - SAFE_ZONE_INSET, newXpx));
      newYpx = Math.max(SAFE_ZONE_INSET, Math.min(REFERENCE_CARD_SIZE - SAFE_ZONE_INSET, newYpx));

      onUpdate({
        displayWidth: Math.round(newW),
        displayHeight: Math.round(newH),
        x: Math.round(newXpx / REFERENCE_CARD_SIZE * 1000) / 10,
        y: Math.round(newYpx / REFERENCE_CARD_SIZE * 1000) / 10,
      });
    };

    const onUp = (ev) => {
      try { handleEl.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsResizing(false);
      onDragStateChange?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Text edge resize — changes ONE dimension only. Left/right edges change
  // width only; top/bottom edges change height only. The opposite edge stays
  // fixed. Font size NEVER changes.
  const startTextEdgeResize = (e, handleId) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    onDragStateChange?.(true);
    setIsResizing(true);
    const sf = scale;
    const origW = element.displayWidth || (REFERENCE_CARD_SIZE * 0.8);
    const origH = element.displayHeight || 0;

    // For auto-height boxes, measure current height
    let effectiveH = origH;
    if (origH === 0 && contentRef.current) {
      effectiveH = Math.round((contentRef.current.scrollHeight + Math.round(2 * sf) * 2) / sf);
    }

    const origXpx = ((element.x ?? 16) / 100) * REFERENCE_CARD_SIZE;
    const origYpx = ((element.y ?? 20) / 100) * REFERENCE_CARD_SIZE;
    const startX = e.clientX;
    const startY = e.clientY;
    const handleEl = e.currentTarget;
    try { handleEl.setPointerCapture(e.pointerId); } catch {}

    const cardMax = REFERENCE_CARD_SIZE - SAFE_ZONE_INSET;

    const onMove = (ev) => {
      const dxRef = (ev.clientX - startX) / sf;
      const dyRef = (ev.clientY - startY) / sf;

      if (handleId === 'e' || handleId === 'w') {
        const dW = handleId === 'w' ? -dxRef : dxRef;
        let newW = Math.max(60, origW + dW);
        let newXpx = origXpx;
        if (handleId === 'w') {
          const rightEdge = origXpx + origW;
          newXpx = rightEdge - newW;
          if (newXpx < SAFE_ZONE_INSET) { newXpx = SAFE_ZONE_INSET; newW = rightEdge - SAFE_ZONE_INSET; }
        } else {
          if (origXpx + newW > cardMax) newW = cardMax - origXpx;
        }
        onUpdate({
          displayWidth: Math.round(newW),
          x: Math.round(newXpx / REFERENCE_CARD_SIZE * 1000) / 10,
        });
      } else {
        const dH = handleId === 'n' ? -dyRef : dyRef;
        let newH = Math.max(0, effectiveH + dH);
        let newYpx = origYpx;
        if (handleId === 'n') {
          const bottomEdge = origYpx + effectiveH;
          newYpx = bottomEdge - newH;
          if (newYpx < SAFE_ZONE_INSET) { newYpx = SAFE_ZONE_INSET; newH = bottomEdge - SAFE_ZONE_INSET; }
        } else {
          if (origYpx + newH > cardMax) newH = cardMax - origYpx;
        }
        onUpdate({
          displayHeight: Math.round(newH),
          y: Math.round(newYpx / REFERENCE_CARD_SIZE * 1000) / 10,
        });
      }
    };

    const onUp = (ev) => {
      try { handleEl.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsResizing(false);
      onDragStateChange?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Double-click an edge handle to auto-fit the box height to the text content
  // at the current width (Canva-style).
  const handleEdgeDoubleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const node = contentRef.current;
    if (!node) return;
    const sf = scale;
    const padPx = Math.round(2 * sf);
    const scrollHeight = node.scrollHeight;
    const newH = Math.round((scrollHeight + padPx * 2) / sf);
    const safeZone = REFERENCE_CARD_SIZE - 2 * SAFE_ZONE_INSET;
    onUpdate({ displayHeight: Math.max(0, Math.min(safeZone, newH)) });
  };

  const handleBlur = (e) => {
    const text = e.target.innerText;
    prevContentRef.current = text;
    const updates = { content: text };
    // Any manual edit locks the font size wherever it currently sits. The
    // content-aware auto-estimate below (computeEstimatedFontSize) is only
    // meant to size an AI Generate-mode card's text on its initial, unedited
    // mount — once a person has actually typed into a box in the builder, it
    // should never silently resize itself again, whether that box was
    // created manually or came from an AI-generated story.
    if (!element.font_size_locked) updates.font_size_locked = true;
    onUpdate(updates);
    setEditing(false);
    setIsEmpty(!text.trim());
  };

  // Capture intrinsic dimensions once, and set an initial display height from
  // the natural aspect ratio for 'original' images still at the default size.
  const handleImgLoad = (e) => {
    loadedUrlRef.current = resolvedMediaSrc;
    setLoadTick((t) => t + 1);
    const img = e.currentTarget;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return;
    const updates = {};
    if (!element.naturalWidth) updates.naturalWidth = nw;
    if (!element.naturalHeight) updates.naturalHeight = nh;
    if ((!element.displayHeight || element.displayHeight === 192) && (element.crop_ratio === 'original' || !element.crop_ratio)) {
      const dw = element.displayWidth || 192;
      updates.displayHeight = Math.round(dw * nh / nw);
    }
    if (Object.keys(updates).length) onUpdate(updates);
  };

  // If a src ever fails to load (bad URL, revoked blob, network error), stop
  // showing the spinner rather than leaving it spinning forever — the broken
  // media itself is a separate, pre-existing concern.
  const handleMediaError = () => {
    loadedUrlRef.current = resolvedMediaSrc;
    setLoadTick((t) => t + 1);
  };

  // Videos: capture intrinsic dimensions + duration from metadata.
  const handleVideoLoad = (e) => {
    loadedUrlRef.current = resolvedMediaSrc;
    setLoadTick((t) => t + 1);
    const v = e.currentTarget;
    // Force the first frame to paint — preload="metadata" alone can leave the
    // video blank in the creator canvas. Seeking to 0.1s triggers a frame decode.
    try { v.currentTime = 0.1; } catch {}
    const nw = v.videoWidth, nh = v.videoHeight;
    const updates = {};
    if (nw && nh && !element.naturalWidth) { updates.naturalWidth = nw; updates.naturalHeight = nh; }
    if (v.duration && !element.duration) updates.duration = v.duration;
    if (nw && nh && (!element.displayHeight || element.displayHeight === 192) && (element.crop_ratio === 'original' || !element.crop_ratio)) {
      const dw = element.displayWidth || 192;
      updates.displayHeight = Math.round(dw * nh / nw);
    }
    if (Object.keys(updates).length) onUpdate(updates);
  };

  // Small play-badge overlay shown on videos in the creator canvas.
  const VideoBadge = () => (
    <div className="absolute top-1.5 right-1.5 bg-black/55 text-white rounded-full flex items-center justify-center pointer-events-none" style={{ width: 22, height: 22 }}>
      <Play size={12} fill="white" />
    </div>
  );

  // ── Image / Video element ──
  if (isImageLike(element.type)) {
    const sf = scale;
    const cropRatio = element.crop_ratio || 'fill';
    const zoom = element.zoom ?? 100;
    const overlayStyle = buildOverlayStyle(element);
    const isBlur = element.overlay_type === 'Blur';
    const blurStrength = ((element.overlay_intensity ?? 50) / 100) * 12;
    const blurDir = ({ Bottom: 'to top', Top: 'to bottom', Left: 'to right', Right: 'to left' })[element.overlay_position || 'Bottom'];
    const isVideo = element.type === 'video';
    const focalX = element.focalX ?? 50;
    const focalY = element.focalY ?? 50;

    // No resolved src yet (e.g. a private file_uri still awaiting its signed
    // URL) — render nothing rather than an <img>/<video> with an empty src,
    // which some browsers treat inconsistently (occasionally firing a spurious
    // error). The spinner overlay below covers this gap on its own.
    const renderMedia = (extraStyle) => {
      if (!resolvedMediaSrc) return null;
      return isVideo
        ? (
          <video
            src={resolvedMediaSrc} draggable={false} muted playsInline preload="metadata"
            className="pointer-events-none"
            style={{ objectFit: 'cover', willChange: 'transform', ...extraStyle }}
            onLoadedMetadata={handleVideoLoad}
            onError={handleMediaError}
          />
        )
        : (
          <img
            src={resolvedMediaSrc} alt="" draggable={false}
            decoding="async"
            className="pointer-events-none"
            style={{ objectFit: 'cover', ...extraStyle }}
            onLoad={handleImgLoad}
            onError={handleMediaError}
          />
        );
    };

    // Non-fill — independent size (displayWidth/Height) and crop (clip values).
    const { displayWidth, displayHeight } = getDisplayDims();
    const clipTop = element.clipTop || 0, clipBottom = element.clipBottom || 0;
    const clipLeft = element.clipLeft || 0, clipRight = element.clipRight || 0;
    const visibleW = Math.max(20, displayWidth - clipLeft - clipRight);
    const visibleH = Math.max(20, displayHeight - clipTop - clipBottom);

    const handlePos = imageHandlePositions({
      left: ((element.x ?? 0) / 100) * REFERENCE_CARD_SIZE,
      top: ((element.y ?? 0) / 100) * REFERENCE_CARD_SIZE,
      width: visibleW,
      height: visibleH,
      sf,
    });

    return (
      <div
        ref={elRef}
        data-canvas-el
        className={`absolute cursor-move ${isSelected ? 'ring-2 ring-blue-400 rounded' : (isHovered ? 'ring-1 ring-blue-400/40 rounded' : '')}`}
        style={{
          left: `${element.x ?? 0}%`,
          top: `${element.y ?? 0}%`,
          width: visibleW * sf,
          height: visibleH * sf,
          zIndex: element.z_index ?? 1,
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => onHover?.(element.id)}
        onMouseLeave={() => onHover?.(null)}
        onClick={e => { e.stopPropagation(); onSelect(); }}
      >
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: (element.borderRadius || 0) * sf }}>
          <div
            style={{
              position: 'absolute',
              left: -clipLeft * sf,
              top: -clipTop * sf,
              width: displayWidth * sf,
              height: displayHeight * sf,
            }}
          >
            {renderMedia({ width: '100%', height: '100%', objectPosition: `${focalX}% ${focalY}%`, transform: `scale(${zoom / 100}) rotate(${element.rotation || 0}deg) scale(${element.flipH ? -1 : 1}, ${element.flipV ? -1 : 1})`, transformOrigin: 'center center' })}
          </div>
          {overlayStyle && <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />}
          {isBlur && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backdropFilter: `blur(${blurStrength}px)`, WebkitBackdropFilter: `blur(${blurStrength}px)`,
                background: `linear-gradient(${blurDir}, rgba(0,0,0,0.01) 0%, transparent 60%)` }} />
          )}
          <ImageSkeleton loaded={mediaLoaded} />
          {showSpinner && !mediaLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <PixelSpinner size={18} />
            </div>
          )}
        </div>
        {isVideo && <VideoBadge />}
        {isSelected && (
          <>
            {CORNER_HANDLES.map(h => (
              <div
                key={h.id}
                onPointerDown={(e) => startResize(e, h.id, true)}
                className="absolute flex items-center justify-center"
                style={{ width: 28, height: 28, cursor: h.cursor, zIndex: 10, touchAction: 'none', ...handlePos[h.id] }}
              >
                <div className="bg-white border-2 border-blue-500 rounded-full pointer-events-none" style={{ width: 12, height: 12 }} />
              </div>
            ))}
            {EDGE_HANDLES.map(h => {
              const vertical = h.id === 'n' || h.id === 's';
              return (
                <div
                  key={h.id}
                  onPointerDown={(e) => startCrop(e, h.id)}
                  className="absolute flex items-center justify-center"
                  style={{
                    width: vertical ? 32 : 20,
                    height: vertical ? 20 : 32,
                    cursor: h.cursor,
                    zIndex: 10,
                    touchAction: 'none',
                    ...handlePos[h.id],
                  }}
                >
                  <div
                    className="bg-white border-2 border-emerald-500 rounded-full pointer-events-none"
                    style={{ width: vertical ? 22 : 6, height: vertical ? 6 : 22 }}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ── Audio element — resize (free) + drag. No crop, no background, no overlay. ──
  if (element.type === 'audio') {
    const sf = scale;
    const { displayWidth, displayHeight } = getDisplayDims();
    const visibleW = Math.max(60, displayWidth);
    const visibleH = Math.max(40, displayHeight);

    return (
      <div
        ref={elRef}
        data-canvas-el
        className={`absolute cursor-move ${isSelected ? 'ring-2 ring-blue-400 rounded' : (isHovered ? 'ring-1 ring-blue-400/40 rounded' : '')}`}
        style={{
          left: `${element.x ?? 10}%`,
          top: `${element.y ?? 40}%`,
          width: visibleW * sf,
          height: visibleH * sf,
          zIndex: element.z_index ?? 1,
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => onHover?.(element.id)}
        onMouseLeave={() => onHover?.(null)}
        onClick={e => { e.stopPropagation(); onSelect(); }}
      >
        <AudioWidget
          url={resolveMediaUrl(element.image_url)}
          duration={element.duration}
          width={visibleW * sf}
          height={visibleH * sf}
          interactive={false}
          cardBg={cardBg}
          trimStart={element.trimStart || 0}
          trimEnd={element.trimEnd || 0}
        />
        {isSelected && (
          <>
            {CORNER_HANDLES.map(h => (
              <div
                key={h.id}
                onPointerDown={(e) => startResize(e, h.id, false)}
                className="absolute flex items-center justify-center"
                style={{ width: 28, height: 28, cursor: h.cursor, zIndex: 10, touchAction: 'none', ...cornerStyle(h.id) }}
              >
                <div className="bg-white border-2 border-blue-500 rounded-full pointer-events-none" style={{ width: 12, height: 12 }} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── Text element ──
  // Uses scaled dimensions (fontSize * scale, width * scale) instead of
  // transform: scale so the box auto-sizes naturally with content. The outer
  // div has NO overflow: hidden so corner resize handles are visible; an inner
  // wrapper clips the text content. displayWidth is stored unclamped — visual
  // clamping to the safe zone happens in the render with position adjustment.
  const baseFontSize = element.font_size ? parseInt(element.font_size) : 14;
  // Safe-zone clamping of size and position — shared with CardThumb so the
  // published card places the box exactly where the editor shows it.
  const { xPct: adjX, yPct: adjY, width: visWidth, height: visHeight } = getTextBoxLayout(element);

  const textDeco = [
    element.font_underline ? 'underline' : '',
    element.font_strikethrough ? 'line-through' : '',
  ].filter(Boolean).join(' ') || 'none';
  // Warped text is display-only (plain while typing) and draws its own
  // per-letter decoration — see WarpedText.jsx.
  const showWarp = !editing && hasTextWarp(element);
  const textFontSize = baseFontSize * scale;
  const textWidthPx = visWidth * scale;
  const textHeightPx = visHeight > 0 ? visHeight * scale : undefined;
  const maxTextHeightPx = safeZoneSize * scale;
  const padPx = Math.round(2 * scale);

  return (
    <div
      ref={elRef}
      data-canvas-el
      data-text-element-id={element.id}
      className={`absolute cursor-move ${isSelected ? 'ring-1 ring-blue-400/60 rounded' : (isHovered ? 'ring-1 ring-blue-400/40 rounded' : '')}`}
      style={{
        left: `${adjX}%`,
        top: `${adjY}%`,
        width: textWidthPx,
        zIndex: element.z_index ?? 1000,
      }}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => onHover?.(element.id)}
      onMouseLeave={() => onHover?.(null)}
      onDoubleClick={handleDoubleClick}
      onClick={e => { e.stopPropagation(); onSelect(); }}
    >
      <div
        className="relative overflow-visible"
        style={{
          width: textWidthPx,
          maxHeight: maxTextHeightPx,
          padding: padPx,
          borderRadius: 4,
        }}
      >
        <div
          ref={contentRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onInput={handleInput}
          className={`outline-none whitespace-pre-wrap break-words ${editing ? 'cursor-text' : ''}`}
          style={{
            fontSize: textFontSize,
            fontWeight: element.font_weight || '400',
            color: resolveColor(element.color_token, tokens, element.color || '#000000'),
            fontFamily: element.font_family || 'Inter',
            lineHeight: baseFontSize >= 32 ? '1.05' : '1.3',
            minWidth: 40,
            minHeight: Math.round(baseFontSize * (baseFontSize >= 32 ? 1.05 : 1.3) * scale),
            width: textWidthPx - padPx * 2,
            height: textHeightPx ? textHeightPx - padPx * 2 : undefined,
            maxHeight: maxTextHeightPx - padPx * 2,
            overflow: 'visible',
            userSelect: editing ? 'text' : 'none',
            fontStyle: element.font_italic ? 'italic' : 'normal',
            textAlign: element.text_align || 'left',
            textDecoration: showWarp ? 'none' : textDeco,
            textTransform: element.text_transform || 'none',
            ...getTextEffectStyle(element, scale),
          }}
        >
          {/* Warped text is display-only: while the box is being typed into
              it shows as plain text (a contentEditable full of per-letter
              spans can't be edited sanely), then re-warps on blur. */}
          {showWarp
            ? <WarpedText text={element.content || ''} warp={element.text_warp} amount={element.text_warp_amount} decoration={textDeco} />
            : (element.content || '')}
        </div>
        {isEmpty && (
          <div
            className="absolute pointer-events-none whitespace-pre-wrap break-words flex items-baseline"
            style={{
              left: padPx,
              top: padPx,
              fontSize: textFontSize,
              fontWeight: element.font_weight || '400',
              color: '#9CA3AF',
              fontFamily: element.font_family || 'Inter',
              lineHeight: baseFontSize >= 32 ? '1.05' : '1.3',
              width: textWidthPx - padPx * 2,
              maxHeight: maxTextHeightPx - padPx * 2,
              overflow: 'hidden',
              fontStyle: element.font_italic ? 'italic' : 'normal',
              textAlign: element.text_align || 'left',
              textDecoration: [
                element.font_underline ? 'underline' : '',
                element.font_strikethrough ? 'line-through' : '',
              ].filter(Boolean).join(' ') || 'none',
            }}
          >
            {/* Blinking caret — invites tapping/typing into an untouched text
                box, reusing the same blink-cursor keyframe as the landing page. */}
            <span
              style={{
                display: 'inline-block',
                width: Math.max(1, Math.round(1.5 * scale)),
                height: '1em',
                marginRight: 2,
                background: resolveColor(element.color_token, tokens, element.color || '#000000'),
                animation: 'blink-cursor 1s step-end infinite',
              }}
            />
            Text
          </div>
        )}
      </div>
      {isSelected && !editing && (
        <>
          {CORNER_HANDLES.map(h => (
            <div
              key={h.id}
              onPointerDown={(e) => startTextResize(e, h.id)}
              className="absolute flex items-center justify-center"
              style={{ width: 28, height: 28, cursor: h.cursor, zIndex: 10, touchAction: 'none', ...cornerStyle(h.id) }}
            >
              <div className="bg-white border-2 border-blue-500 rounded-full pointer-events-none" style={{ width: 12, height: 12 }} />
            </div>
          ))}
          {EDGE_HANDLES.map(h => {
            const vertical = h.id === 'n' || h.id === 's';
            return (
              <div
                key={h.id}
                onPointerDown={(e) => startTextEdgeResize(e, h.id)}
                onDoubleClick={handleEdgeDoubleClick}
                className="absolute flex items-center justify-center"
                style={{
                  width: vertical ? 32 : 20,
                  height: vertical ? 20 : 32,
                  cursor: h.cursor,
                  zIndex: 10,
                  touchAction: 'none',
                  ...edgeStyle(h.id),
                }}
              >
                <div
                  className="bg-white border-2 border-blue-500 rounded-full pointer-events-none"
                  style={{ width: vertical ? 22 : 6, height: vertical ? 6 : 22 }}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}