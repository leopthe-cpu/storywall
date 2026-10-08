import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Camera, FolderOpen, Image as ImageIcon, Mic, Play, Film, Music, RefreshCw, RotateCw, FlipHorizontal, FlipVertical, Eraser } from '@/components/icons';
import { base44 } from '@/api/base44Client';
import { registerMedia } from '@/lib/mediaLibrary';
import { useDraftMedia } from '@/components/creator/DraftMediaContext';
import ColorPicker from '@/components/creator/ColorPicker';
import MinimalSlider from '@/components/creator/MinimalSlider';
import ThumbMenu, { ReorderBar } from '@/components/creator/ThumbMenu';
import AudioRecorder from '@/components/creator/AudioRecorder';
import TrimPanel from '@/components/creator/panels/TrimPanel';
import SizeStepper from '@/components/creator/SizeStepper';
import PixelSpinner from '@/components/ui/PixelSpinner';
import { REFERENCE_CARD_SIZE } from '@/components/creator/CanvasArea';
import { getImageDisplayDims } from '@/lib/imageLayout';
import { ENABLE_VIDEO_AND_AUDIO } from '@/lib/featureFlags';
import { useIsMobile } from '@/hooks/use-mobile';
import { optimizeImageFile, withTimeout } from '@/lib/imageOptimize';
import { useToast } from '@/components/ui/use-toast';

// Uploads can stall on a bad connection with no error ever firing — this
// caps how long we wait before giving the user their UI back and a way to
// retry, instead of a spinner that spins forever.
const UPLOAD_TIMEOUT_MS = 45000;

const TAB_LABELS = { gallery: 'Gallery', sizing: 'Sizing', trim: 'Trim', overlay: 'Overlay', position: 'Position' };

function tabsForType(type) {
  if (type === 'audio') return ['gallery', 'trim', 'position'];
  if (type === 'video') return ['gallery', 'sizing', 'trim', 'overlay', 'position'];
  return ['gallery', 'sizing', 'overlay', 'position'];
}
function defaultTabForType(type) {
  return type === 'audio' ? 'trim' : 'sizing';
}

const CROP_OPTIONS = [
  { label: 'Fit to card', value: 'fill' },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: '1/1' },
  { label: '4:3', value: '4/3' },
  { label: '16:9', value: '16/9' },
  { label: '9:16', value: '9/16' },
];
const OVERLAY_TYPES = ['None', 'Dark', 'Color', 'Blur'];
const OVERLAY_POSITIONS = ['Bottom', 'Top', 'Left', 'Right', 'Full'];
const TILE = 64;

// Active = the builder's green "selected" style (same as BottomIsland and
// the galleries). Idle buttons carry a transparent border so turning one on
// doesn't change its size.
const ACTIVE_BTN = 'bg-emerald-400/10 border border-emerald-400 text-emerald-400';
const IDLE_BTN = 'bg-white/10 border border-transparent text-white/60 hover:bg-white/15';

// A tab turns green when something non-default is applied inside it. The
// edits are split over two tabs: Sizing (crop, zoom, rotate, flip, corners)
// and Overlay. Gallery, Trim and Position never turn green.
function tabHasChanges(tab, el) {
  if (!el) return false;
  if (tab === 'sizing') {
    return ['clipTop', 'clipBottom', 'clipLeft', 'clipRight'].some((k) => (el[k] || 0) > 0)
      || (el.zoom ?? 100) !== 100 || (el.rotation || 0) !== 0
      || !!el.flipH || !!el.flipV || (el.borderRadius || 0) > 0;
  }
  if (tab === 'overlay') return (el.overlay_type || 'None') !== 'None';
  return false;
}

const DEFAULT_IMG_PROPS = {
  x: 20, y: 20, z_index: 1,
  displayWidth: 192, displayHeight: 192,
  naturalWidth: 0, naturalHeight: 0,
  clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
  crop_ratio: 'original', zoom: 100,
  overlay_type: 'None', overlay_position: 'Bottom', overlay_intensity: 50, overlay_color: '#000000',
};
const DEFAULT_AUDIO_PROPS = {
  x: 10, y: 40, z_index: 1,
  displayWidth: 220, displayHeight: 60,
};

function defaultPropsForType(type) {
  return type === 'audio' ? DEFAULT_AUDIO_PROPS : DEFAULT_IMG_PROPS;
}

function detectMediaType(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

function fmtDuration(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getMediaDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(el.duration) ? el.duration : 0); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    el.src = url;
  });
}

export default function MediaPanel({ selectedElement, onUpdateElement, onUpdateElementById, onAddElement, onDeleteElement, currentCard, currentCardIndex, onSelectElement, onDuplicateElementToCard, onUpdateCard, cards = [], onNavigate, onRemoveMediaByUrl, galleryResetToken }) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [tab, setTab] = useState('gallery');

  // A new card was just created — open on Gallery instead of whatever tab
  // (sizing/trim/overlay/position) was last used on a previous card.
  useEffect(() => {
    if (galleryResetToken == null) return;
    setTab('gallery');
  }, [galleryResetToken]);
  const [uploading, setUploading] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [reorderItems, setReorderItems] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const dragIdx = useRef(null);
  const replaceFileRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const { resolveMediaUrl } = useDraftMedia();

  // Gallery is scoped to the current story — derived from the media elements
  // actually placed on the story's cards, not the account-wide Media library.
  // One entry per unique image_url, but `placements` tracks EVERY card it's
  // actually on (an image can now be added to more than one card via the
  // gallery's "Add to card" action) — drives the per-item card-position
  // badges and the "already on this card" green highlight below.
  const derivedItems = useMemo(() => {
    const byUrl = new Map();
    cards.forEach((card, cardIndex) => {
      for (const el of (card?.elements || [])) {
        if ((el.type === 'image' || el.type === 'video' || el.type === 'audio') && el.image_url) {
          if (!byUrl.has(el.image_url)) {
            byUrl.set(el.image_url, { id: el.id, image_url: el.image_url, media_type: el.type, duration: el.duration, placements: [] });
          }
          byUrl.get(el.image_url).placements.push({ cardIndex, elementId: el.id });
        }
      }
    });
    const items = Array.from(byUrl.values());
    if (!ENABLE_VIDEO_AND_AUDIO) return items.filter(m => (m.media_type || 'image') === 'image');
    return items;
  }, [cards]);
  const mediaItems = reorderItems || derivedItems;

  // Auto-open the relevant tab when a media element is selected from the canvas
  useEffect(() => {
    if (selectedElement) setTab(defaultTabForType(selectedElement.type));
  }, [selectedElement?.id]);

  const handleUpload = async (file) => {
    if (!file) return;
    const mtype = detectMediaType(file);
    if (!ENABLE_VIDEO_AND_AUDIO && mtype !== 'image') return;
    setUploading(true);
    setShowAddOptions(false);

    // Optimistic preview: place the element on the card right away using a
    // local blob URL for the picked file, instead of waiting on the full
    // optimize+upload+save round trip before anything appears on screen.
    // Swapped for the real uploaded URL on success, or removed entirely if
    // the upload ends up failing.
    let localUrl = null;
    let newElementId = null;
    try {
      localUrl = URL.createObjectURL(file);
      newElementId = onAddElement({ type: mtype, image_url: localUrl, duration: 0, ...defaultPropsForType(mtype) });
      setTab(defaultTabForType(mtype));
    } catch (e) {
      console.error('[MediaPanel] optimistic preview failed, falling back to blocking upload', e);
      localUrl = null;
      newElementId = null;
    }

    try {
      // Downscale/re-encode oversized photos before they ever leave the
      // device — cuts upload time and what every future viewer has to
      // download to render this card. No-ops for anything already small,
      // for GIFs, and for non-images (video/audio pass through untouched).
      const uploadFile = mtype === 'image' ? await optimizeImageFile(file) : file;
      const { file_uri } = await withTimeout(
        base44.integrations.Core.UploadPrivateFile({ file: uploadFile }),
        UPLOAD_TIMEOUT_MS,
        'Upload timed out'
      );
      const duration = (mtype === 'video' || mtype === 'audio') ? await getMediaDuration(file) : 0;
      try {
        await registerMedia({ image_url: file_uri, media_type: mtype, duration });
      } catch (e) {
        console.error('Media library save failed', e);
      }
      if (newElementId) {
        // Swap the local preview for the real uploaded URL, by id — NOT via
        // the selection-bound onUpdateElement. Selection can move on before
        // this await resolves (e.g. a second upload started, or the user
        // tapped something else), and updating "whatever's selected right
        // now" would silently corrupt a different element while leaving
        // this one's now-dead blob: preview in place forever.
        if (onUpdateElementById) {
          onUpdateElementById(newElementId, { image_url: file_uri, duration });
        } else {
          onUpdateElement({ image_url: file_uri, duration });
        }
      } else {
        onAddElement({ type: mtype, image_url: file_uri, duration, ...defaultPropsForType(mtype) });
        setTab(defaultTabForType(mtype));
      }
    } catch (e) {
      console.error(e);
      if (newElementId) onDeleteElement?.(newElementId);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: e?.message === 'Upload timed out'
          ? "That's taking too long — check your connection and try again."
          : 'Something went wrong uploading that file. Please try again.',
      });
    } finally {
      setUploading(false);
      // Defer to the next paint so the swapped-in real <img src> has actually
      // rendered before the local blob backing it is freed, rather than
      // racing React's re-render in the same tick.
      if (localUrl) { const u = localUrl; requestAnimationFrame(() => URL.revokeObjectURL(u)); }
    }
  };

  // Replace the selected element's image with a newly uploaded file.
  // Also saves the new file to the media gallery.
  const handleReplaceUpload = async (file) => {
    if (!file || !selectedElement) return;
    setUploading(true);
    const targetId = selectedElement.id;
    const previousUrl = selectedElement.image_url;
    // Update by id throughout, not the selection-bound onUpdateElement —
    // selection can move to a different element while this upload is still
    // in flight, and an update targeting "whatever's selected now" would
    // land on the wrong element instead of this one.
    const updateTarget = (updates) => (onUpdateElementById ? onUpdateElementById(targetId, updates) : onUpdateElement(updates));

    // Same optimistic-preview approach as handleUpload above: show the newly
    // picked file immediately via a local blob URL, swap in the real
    // uploaded URL on success, revert to the previous image on failure.
    let localUrl = null;
    try {
      localUrl = URL.createObjectURL(file);
      updateTarget({ image_url: localUrl });
    } catch (e) {
      console.error('[MediaPanel] optimistic replace-preview failed, falling back to blocking upload', e);
      localUrl = null;
    }

    try {
      const uploadFile = await optimizeImageFile(file);
      const { file_uri } = await withTimeout(
        base44.integrations.Core.UploadPrivateFile({ file: uploadFile }),
        UPLOAD_TIMEOUT_MS,
        'Upload timed out'
      );
      try {
        await registerMedia({ image_url: file_uri, media_type: 'image' });
      } catch (e) {
        console.error('Media library save failed', e);
      }
      updateTarget({ image_url: file_uri, naturalWidth: 0, naturalHeight: 0 });
    } catch (e) {
      console.error(e);
      if (localUrl) updateTarget({ image_url: previousUrl });
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: e?.message === 'Upload timed out'
          ? "That's taking too long — check your connection and try again."
          : 'Something went wrong uploading that file. Please try again.',
      });
    } finally {
      setUploading(false);
      if (localUrl) { const u = localUrl; requestAnimationFrame(() => URL.revokeObjectURL(u)); }
    }
  };

  // Save a recorded audio blob to the gallery.
  const handleRecorded = async (file_uri, duration) => {
    setRecording(false);
    setUploading(true);
    try {
      await registerMedia({ image_url: file_uri, media_type: 'audio', duration });
    } catch (e) {
      console.error('Media library save failed', e);
    }
    onAddElement({ type: 'audio', image_url: file_uri, duration, ...defaultPropsForType('audio') });
    setTab(defaultTabForType('audio'));
    setUploading(false);
  };

  // Tapping a thumbnail: if the media is already placed on a card, jump to
  // that card and select it; otherwise add it to the current card.
  const selectMedia = (item) => {
    const mtype = item.media_type || 'image';
    for (let i = 0; i < cards.length; i++) {
      const found = cards[i]?.elements?.find(e => e.image_url === item.image_url);
      if (found) {
        onNavigate?.(i);
        onSelectElement?.(found.id);
        setTab(defaultTabForType(mtype));
        return;
      }
    }
    onAddElement({ type: mtype, image_url: item.image_url, duration: item.duration, ...defaultPropsForType(mtype) });
    setTab(defaultTabForType(mtype));
  };

  // "Add to card" (replaces plain Duplicate in this gallery): places a copy
  // of this media onto whichever card the user picks from the kebab's
  // card-number grid — including the current card, or a card it's already
  // on. Uses one of the item's existing placements as the template to copy
  // display/crop/overlay settings from; falls back to a fresh element with
  // this gallery entry's own defaults if somehow none exist yet.
  const addMediaToCard = (item, targetCardIndex) => {
    const mtype = item.media_type || 'image';
    const templateCardIndex = item.placements?.[0]?.cardIndex;
    const templateEl = templateCardIndex != null
      ? cards[templateCardIndex]?.elements?.find(e => e.id === item.placements[0].elementId)
      : null;
    if (templateEl && onDuplicateElementToCard) {
      onDuplicateElementToCard(templateEl, targetCardIndex);
      return;
    }
    const newEl = { type: mtype, image_url: item.image_url, duration: item.duration, ...defaultPropsForType(mtype) };
    if (targetCardIndex === currentCardIndex) {
      onAddElement(newEl);
    } else {
      onNavigate?.(targetCardIndex);
      onAddElement(newEl);
    }
  };

  const deleteMedia = async (item) => {
    onRemoveMediaByUrl?.(item.image_url);
    if (selectedElement?.image_url === item.image_url) onSelectElement?.(null);
    try {
      const user = await base44.auth.me();
      if (user) await base44.entities.Media.deleteMany({ user_id: user.id, image_url: item.image_url });
    } catch (e) {
      console.error(e);
    }
  };

  const onDragStart = (e, i) => { dragIdx.current = i; };
  const onDrop = (e, dropI) => {
    e.preventDefault();
    const di = dragIdx.current;
    if (di == null || di === dropI) return;
    const next = [...mediaItems];
    const [m] = next.splice(di, 1);
    next.splice(dropI, 0, m);
    setReorderItems(next);
    dragIdx.current = null;
  };

  const selType = selectedElement?.type;
  const isImageLikeSel = selType === 'image' || selType === 'video';
  const isAudioSel = selType === 'audio';
  const tabs = tabsForType(selType);

  // Keep the active tab valid for the selected media type (e.g. deselecting an
  // audio element while on the Trim tab falls back to Gallery).
  useEffect(() => {
    if (!selectedElement && !tabs.includes(tab)) setTab('gallery');
  }, [selectedElement, tabs, tab]);

  if (showColorPicker && selectedElement?.overlay_type === 'Color') {
    return (
      <ColorPicker
        color={selectedElement.overlay_color || '#000000'}
        onChange={(c) => onUpdateElement({ overlay_color: c })}
        onClose={() => setShowColorPicker(false)}
        dark
      />
    );
  }

  if (recording) {
    return <AudioRecorder onUse={handleRecorded} onCancel={() => setRecording(false)} />;
  }

  const cropRatio = selectedElement?.crop_ratio || 'original';
  // For button highlighting: null means no ratio matches (custom size/zoom).
  const selectedRatio = (() => {
    if (!selectedElement) return cropRatio;
    const dw = selectedElement.displayWidth ?? 192;
    const dh = selectedElement.displayHeight ?? 192;
    if (cropRatio === '1/1' && dw === 192 && dh === 192) return '1/1';
    if (cropRatio === '4/3' && dw === 192 && dh === 144) return '4/3';
    if (cropRatio === '16/9' && dw === 192 && dh === 108) return '16/9';
    if (cropRatio === '9/16' && dw === 108 && dh === 192) return '9/16';
    if (cropRatio === 'original') {
      const nw = selectedElement.naturalWidth, nh = selectedElement.naturalHeight;
      if (nw && nh) {
        const a = nw / nh;
        const w = a >= 1 ? 192 : Math.round(192 * a);
        const h = a >= 1 ? Math.round(192 / a) : 192;
        if (dw === w && dh === h) return 'original';
      } else if (dw === 192 && dh === 192) {
        return 'original';
      }
    }
    return null;
  })();
  const zoom = selectedElement?.zoom ?? 100;
  const overlayType = selectedElement?.overlay_type || 'None';
  const overlayPosition = selectedElement?.overlay_position || 'Bottom';
  const overlayIntensity = selectedElement?.overlay_intensity ?? 50;
  const overlayColor = selectedElement?.overlay_color || '#000000';
  const showPosition = overlayType === 'Dark' || overlayType === 'Blur' || overlayType === 'Color';
  const hasSelection = !!selectedElement;

  const applyCropRatio = (value) => {
    // Fit to card — one-time resize to match the card's size. The image
    // becomes a normal image: no persistent mode, no special rendering.
    // The user can freely resize and crop it afterward via normal controls.
    // It sizes the picture to COVER the card at the photo's own proportions
    // (short side = card size, long side overflowing), centred — so the card
    // is exactly the visible frame. It used to force a 320×320 square box,
    // which cropped the photo invisibly and then jumped shape on the first
    // corner drag. From here the user can enlarge it and drag it in any
    // direction; only what's inside the card shows.
    if (value === 'fill') {
      const refSize = REFERENCE_CARD_SIZE;
      const nw = selectedElement?.naturalWidth, nh = selectedElement?.naturalHeight;
      let w = refSize, h = refSize;
      if (nw && nh) {
        const a = nw / nh;
        if (a >= 1) { h = refSize; w = Math.round(refSize * a); }
        else { w = refSize; h = Math.round(refSize / a); }
      }
      onUpdateElement({
        crop_ratio: 'original',
        x: Math.round(((refSize - w) / 2 / refSize) * 10000) / 100,
        y: Math.round(((refSize - h) / 2 / refSize) * 10000) / 100,
        displayWidth: w, displayHeight: h,
        clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
        zoom: 100, focalX: 50, focalY: 50,
      });
      return;
    }

    // Regular aspect ratio change for a non-background image/video. Picking
    // any preset (including Original) starts from a clean, uncropped slate —
    // an old crop's insets were computed for the box's previous size/shape
    // and carrying them over here would no longer line up correctly.
    const updates = { crop_ratio: value, clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0 };
    if (value === '1/1') { updates.displayWidth = 192; updates.displayHeight = 192; }
    else if (value === '4/3') { updates.displayWidth = 192; updates.displayHeight = 144; }
    else if (value === '16/9') { updates.displayWidth = 192; updates.displayHeight = 108; }
    else if (value === '9/16') { updates.displayWidth = 108; updates.displayHeight = 192; }
    else if (value === 'original') {
      const nw = selectedElement?.naturalWidth, nh = selectedElement?.naturalHeight;
      if (nw && nh) {
        const a = nw / nh;
        if (a >= 1) { updates.displayWidth = 192; updates.displayHeight = Math.round(192 / a); }
        else { updates.displayWidth = Math.round(192 * a); updates.displayHeight = 192; }
      } else { updates.displayWidth = 192; updates.displayHeight = 192; }
    }
    // Keep the picture where it was: the new (uncropped) box is centred on
    // the centre of the box the user currently sees. x/y are the visible
    // box's top-left in % of the card. Without this, changing the ratio
    // after "Fit to card" (x/y negative, box bigger than the card) left the
    // smaller box stuck near the top-left corner, partly off the card.
    if (selectedElement && updates.displayWidth != null) {
      const ref = REFERENCE_CARD_SIZE;
      const { displayWidth: oldW, displayHeight: oldH } = getImageDisplayDims(selectedElement, ref);
      const visW = Math.max(20, oldW - (selectedElement.clipLeft || 0) - (selectedElement.clipRight || 0));
      const visH = Math.max(20, oldH - (selectedElement.clipTop || 0) - (selectedElement.clipBottom || 0));
      const cx = (selectedElement.x ?? 0) + (visW / ref * 100) / 2;
      const cy = (selectedElement.y ?? 0) + (visH / ref * 100) / 2;
      updates.x = Math.round((cx - (updates.displayWidth / ref * 100) / 2) * 100) / 100;
      updates.y = Math.round((cy - (updates.displayHeight / ref * 100) / 2) * 100) / 100;
    }
    onUpdateElement(updates);
  };

  // Reset all image adjustments back to the original, unedited state.
  const handleReset = () => {
    applyCropRatio('original');
    onUpdateElement({
      zoom: 100,
      borderRadius: 0,
      flipH: false, flipV: false, rotation: 0,
      clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
    });
  };

  // Gallery thumbnail content per media type.
  const renderThumb = (item) => {
    const mtype = item.media_type || 'image';
    if (mtype === 'video') {
      return (
        <div className="relative w-full h-full">
          <video src={resolveMediaUrl(item.image_url)} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
            <Play size={16} className="text-white" fill="white" />
          </div>
        </div>
      );
    }
    if (mtype === 'audio') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
          <Music size={16} className="text-white/50" />
          <span className="text-[9px] text-white/40 mt-0.5">{fmtDuration(item.duration)}</span>
        </div>
      );
    }
    return <img src={resolveMediaUrl(item.image_url)} alt="" className="w-full h-full object-cover pointer-events-none" />;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Hidden file inputs — activated by <label htmlFor> from the menu and
          Replace-image control. Labels use native browser behavior to open the
          file picker, avoiding JavaScript .click() user-activation restrictions. */}
      <input id="media-replace" ref={replaceFileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleReplaceUpload(f); }} className="hidden" />
      <input id="media-photo" ref={photoInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleUpload(f); }} className="hidden" />
      <input id="media-camera" ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleUpload(f); }} className="hidden" />
      <input id="media-file" ref={fileInputRef} type="file" accept={ENABLE_VIDEO_AND_AUDIO ? "image/*,video/*,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/*" : "image/*"} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleUpload(f); }} className="hidden" />
      {ENABLE_VIDEO_AND_AUDIO && (
        <input id="media-video" ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; handleUpload(f); }} className="hidden" />
      )}

      {/* Tab bar */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {tabs.map(t => {
          const changed = tabHasChanges(t, selectedElement);
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t
                  ? `border-b-2 ${changed ? 'text-emerald-400 border-emerald-400' : 'text-white border-white'}`
                  : changed ? 'text-emerald-400/70' : 'text-white/40'}`}>
              {TAB_LABELS[t] || t}
            </button>
          );
        })}
      </div>

      {/* GALLERY */}
      {tab === 'gallery' && (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-3">
            {reorderMode && <ReorderBar onDone={() => { setReorderMode(false); setReorderItems(null); }} />}
            {isImageLikeSel && !reorderMode && (
              <label
                htmlFor="media-replace"
                className={`flex items-center justify-center gap-2 w-full mb-3 py-2.5 rounded bg-white/10 text-white/80 text-sm font-medium hover:bg-white/15 transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <RefreshCw size={14} />
                Replace image
              </label>
            )}
            <div className="flex flex-wrap gap-1">
              {/* Add Media tile — pinned first */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div className="relative">
                  {isMobile && !ENABLE_VIDEO_AND_AUDIO ? (
                    // Mobile (and no video/audio recording to reach): skip our own
                    // Photo Library/Camera/Choose File menu entirely and go straight
                    // to the native OS picker — it already offers those same choices
                    // in one sheet, so our menu was just a redundant extra tap.
                    <label
                      htmlFor="media-photo"
                      className="rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/50 transition-colors cursor-pointer"
                      style={{ width: TILE, height: TILE }}
                    >
                      {uploading ? (
                        <PixelSpinner size={20} tone="light" />
                      ) : (
                        <Plus size={20} className="text-white/40" />
                      )}
                    </label>
                  ) : (
                    <button
                      onClick={() => setShowAddOptions(s => !s)}
                      className="rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
                      style={{ width: TILE, height: TILE }}
                    >
                      {uploading ? (
                        <PixelSpinner size={20} tone="light" />
                      ) : (
                        <Plus size={20} className="text-white/40" />
                      )}
                    </button>
                  )}

                  {showAddOptions && (
                    <>
                      <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowAddOptions(false)} />
                      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#2A2A2A] rounded-2xl border border-white/10 w-72 shadow-2xl overflow-hidden">
                        <label
                          htmlFor="media-photo"
                          className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <ImageIcon size={18} /> Photo Library
                        </label>
                        <label
                          htmlFor="media-camera"
                          className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <Camera size={18} /> Camera
                        </label>
                        {ENABLE_VIDEO_AND_AUDIO && (
                          <label
                            htmlFor="media-video"
                            className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left cursor-pointer"
                          >
                            <Film size={18} /> Video
                          </label>
                        )}
                        <label
                          htmlFor="media-file"
                          className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left cursor-pointer"
                        >
                          <FolderOpen size={18} /> Choose File
                        </label>
                        {ENABLE_VIDEO_AND_AUDIO && (
                          <button
                            onClick={() => { setShowAddOptions(false); setRecording(true); }}
                            className="w-full flex items-center gap-3 px-5 py-4 text-sm text-white/80 hover:bg-white/5 transition-colors text-left"
                          >
                            <Mic size={18} /> Record audio
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <span className="text-[9px] text-white/20">Add</span>
              </div>

              {/* Media library thumbnails. Green border = already placed on
                  the card you're viewing right now (solid once it's also
                  the literally-selected canvas element); card-position
                  badges + the kebab sit in a column to the right instead of
                  centered below, so there's room to show every card an item
                  is placed on, not just one. */}
              {mediaItems.map((item, i) => {
                const onCurrentCard = item.placements.some(p => p.cardIndex === currentCardIndex);
                const isSelected = selectedElement?.image_url === item.image_url;
                return (
                <div key={item.id} className="flex-shrink-0 flex items-start gap-1">
                  <div
                    draggable={reorderMode}
                    onDragStart={reorderMode ? (e) => onDragStart(e, i) : undefined}
                    onDragOver={reorderMode ? (e) => e.preventDefault() : undefined}
                    onDrop={reorderMode ? (e) => onDrop(e, i) : undefined}
                    onClick={reorderMode ? undefined : () => selectMedia(item)}
                    className={`rounded-lg overflow-hidden border-2 transition-colors ${reorderMode ? 'cursor-grab' : ''} ${
                      isSelected ? 'border-emerald-400' : onCurrentCard ? 'border-emerald-400/40' : 'border-white/10 hover:border-white/40'
                    }`}
                    style={{ width: TILE, height: TILE }}
                  >
                    {renderThumb(item)}
                  </div>
                  {!reorderMode && (
                    <div className="flex flex-col items-start gap-1 pt-0.5">
                      {item.placements.map(p => (
                        <span
                          key={p.cardIndex}
                          className={`text-[9px] leading-none px-1 py-0.5 rounded font-mono ${
                            p.cardIndex === currentCardIndex ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {p.cardIndex + 1}/{cards.length}
                        </span>
                      ))}
                      <ThumbMenu
                        onReorder={() => setReorderMode(true)}
                        onDelete={() => deleteMedia(item)}
                        addToCard={{
                          cards,
                          currentIndices: item.placements.map(p => p.cardIndex),
                          onPick: (targetIndex) => addMediaToCard(item, targetIndex),
                        }}
                      />
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SIZING — faded when no selection */}
      {tab === 'sizing' && (
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 ${hasSelection ? '' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <label className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 block">Aspect ratio</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {CROP_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => applyCropRatio(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      selectedRatio === opt.value ? `${ACTIVE_BTN} font-medium` : IDLE_BTN
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 block">Zoom: {zoom}%</label>
              <MinimalSlider min={50} max={200} value={zoom} resetValue={100} ariaLabel="Zoom" onChange={v => onUpdateElement({ zoom: v })} />
            </div>
            <div className="flex items-end gap-3">
              <SizeStepper
                label="Radius"
                value={selectedElement?.borderRadius || 0}
                min={0}
                max={80}
                step={1}
                onChange={(v) => onUpdateElement({ borderRadius: parseInt(v) || 0 })}
              />
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-1 block">Rotate</label>
                <button
                  onClick={() => onUpdateElement({ rotation: ((selectedElement?.rotation || 0) + 90) % 360 })}
                  className="w-8 h-8 rounded bg-white/10 text-white/60 hover:bg-white/15 transition-colors flex items-center justify-center"
                  title="Rotate 90°"
                >
                  <RotateCw size={16} />
                </button>
              </div>
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-1 block">Flip</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => onUpdateElement({ flipH: !selectedElement?.flipH })}
                    className={`w-8 h-8 rounded transition-colors flex items-center justify-center ${
                      selectedElement?.flipH ? ACTIVE_BTN : IDLE_BTN
                    }`}
                    title="Flip horizontal"
                  >
                    <FlipHorizontal size={16} />
                  </button>
                  <button
                    onClick={() => onUpdateElement({ flipV: !selectedElement?.flipV })}
                    className={`w-8 h-8 rounded transition-colors flex items-center justify-center ${
                      selectedElement?.flipV ? ACTIVE_BTN : IDLE_BTN
                    }`}
                    title="Flip vertical"
                  >
                    <FlipVertical size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-wider mb-1 block">Reset</label>
                <button
                  onClick={handleReset}
                  className="w-8 h-8 rounded bg-white/10 text-white/60 hover:bg-white/15 transition-colors flex items-center justify-center"
                  title="Reset all image adjustments"
                >
                  <Eraser size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRIM — audio & video only */}
      {tab === 'trim' && (isAudioSel || selType === 'video') && (
        <TrimPanel
          element={selectedElement}
          onUpdateElement={onUpdateElement}
        />
      )}

      {/* OVERLAY — faded when no selection; audio shows a note */}
      {tab === 'overlay' && (
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto overscroll-contain px-4 py-2 flex flex-col gap-2 ${hasSelection && !isAudioSel ? '' : 'opacity-40 pointer-events-none'}`}>
            {isAudioSel ? (
              <p className="text-white/30 text-xs leading-relaxed text-center py-6">Overlays apply to images and videos only.</p>
            ) : (
              <>
                <div>
                  <label className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 block">Type</label>
                  <div className="flex gap-1.5">
                    {OVERLAY_TYPES.map(t => (
                      <button key={t}
                        onClick={() => {
                          onUpdateElement({ overlay_type: t });
                          if (t === 'Color') setShowColorPicker(true);
                        }}
                        className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                          overlayType === t ? `${ACTIVE_BTN} font-medium` : IDLE_BTN
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {overlayType === 'Color' && (
                  <button onClick={() => setShowColorPicker(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 transition-colors w-fit">
                    <div className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: overlayColor }} />
                    <span className="text-white/60 text-xs font-mono">{overlayColor}</span>
                  </button>
                )}

                {showPosition && (
                  <div>
                    <label className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 block">Direction</label>
                    <div className="flex gap-1.5">
                      {OVERLAY_POSITIONS.map(p => (
                        <button key={p} onClick={() => onUpdateElement({ overlay_position: p })}
                          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                            overlayPosition === p ? `${ACTIVE_BTN} font-medium` : IDLE_BTN
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {overlayType !== 'None' && (
                  <div>
                    <label className="text-white/40 text-[9px] uppercase tracking-wider mb-1.5 block">Intensity: {overlayIntensity}%</label>
                    <MinimalSlider min={0} max={100} value={overlayIntensity} onChange={v => onUpdateElement({ overlay_intensity: v })} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* POSITION — faded when no selection */}
      {tab === 'position' && (
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-2 ${hasSelection ? '' : 'opacity-40 pointer-events-none'}`}>
            <button onClick={() => onUpdateElement({ z_index: Math.min(999, (selectedElement?.z_index ?? 1) + 10) })}
              className="w-full py-3 bg-white/10 text-white/70 text-sm rounded hover:bg-white/15 transition-colors">
              Bring forward
            </button>
            <button onClick={() => onUpdateElement({ z_index: Math.max(1, (selectedElement?.z_index ?? 1) - 10) })}
              className="w-full py-3 bg-white/10 text-white/70 text-sm rounded hover:bg-white/15 transition-colors">
              Send backward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}