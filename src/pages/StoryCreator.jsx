import { useState, useRef, useCallback, useEffect, useReducer } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Undo2, Redo2, PerspectiveView } from '@/components/icons';
import { ENABLE_DARK_MODE } from '@/lib/featureFlags';
import { base44 } from '@/api/base44Client';
import { registerMedia } from '@/lib/mediaLibrary';
import CanvasArea, { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET } from '@/components/creator/CanvasArea';
import BottomIsland, { ISLAND_CHROME } from '@/components/creator/BottomIsland';
import PostFlowSheet from '@/components/creator/PostFlowSheet';
import { DraftMediaProvider } from '@/components/creator/DraftMediaContext';
import { applyTemplateToStory } from '@/lib/storyTemplates';
import { aiCarouselBuilderEnabled } from '@/lib/featureFlags';
import NotesView from '@/components/creator/NotesView';
import GenerateProgress from '@/components/creator/GenerateProgress';
import RegenerateChoice from '@/components/creator/RegenerateChoice';
import { runGeneratePipeline } from '@/lib/generatePipeline';
import { migrateToTokens, applyTokenColorChange, findOrCreateToken, resolveColor } from '@/lib/colorTokens';
import PixelSpinner from '@/components/ui/PixelSpinner';
import useDocumentTitle from '@/lib/useDocumentTitle';
import { useToast } from '@/components/ui/use-toast';

// Dimmed overlay + spinner shown over the card while a draft is being opened.
// Waits ~150ms before appearing so a fast open doesn't flash it.
function DraftLoadingOverlay() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-20 rounded-2xl flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <PixelSpinner size={22} tone="light" />
    </div>
  );
}


// Stacked cards icon — two overlapping squares
function StackedCardsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="11" height="11" rx="2" opacity="0.5" />
      <rect x="2" y="2" width="11" height="11" rx="2" />
    </svg>);

}

const DEFAULT_CARD_COLOR = ENABLE_DARK_MODE ?
window.matchMedia('(prefers-color-scheme: dark)').matches ? '#000000' : '#FFFFFF' :
'#FFFFFF';

const TOP_BAR_HEIGHT = 56;
// Desktop: width of the left tool panel (matches md:w-[360px] below).
const DESKTOP_PANEL_WIDTH = 360;
// How far the add-card button reaches past the card's right edge.
const ADD_CARD_REACH = 46;
// Desktop card size range (px): largest = Oz's reference layout; smallest ≈
// the regular mobile card (73% of a 390px phone).
const DESKTOP_CARD_MAX = 434;
const DESKTOP_CARD_MIN = 285;
// Same as Tailwind's `md` breakpoint (the layout's md: classes).
const DESKTOP_BREAKPOINT = 768;
const CARD_MIN_RATIO = 0.55;
const CARD_MAX_RATIO = 0.75;

function clamp(v, min, max) {return Math.min(max, Math.max(min, v));}

// A story has real content if any card has a non-empty text element or any
// media element with a source URL. Used to gate draft creation so blank
// stories never appear in the Drafts list.
function hasRealContent(cards) {
  return cards.some(card => {
    const elements = card.elements || [];
    return elements.some(el => {
      if (el.type === 'text') return !!(el.content && el.content.trim());
      if (el.type === 'image' || el.type === 'video' || el.type === 'audio') return !!el.image_url;
      return false;
    });
  });
}

// Fields set asynchronously by image/video load handlers, not by user edits.
// Stripped from the dirty comparison so metadata loads after a draft/template
// apply don't make the story appear dirty.
const ELEMENT_METADATA_FIELDS = new Set(['naturalWidth', 'naturalHeight', 'isPannable', 'duration', 'displayHeight']);
const CARD_METADATA_FIELDS = new Set(['imageGenerationFailed', 'imageRetrying']);

function canonicalize(cards) {
  return cards.map(card => {
    const stripped = { ...card };
    for (const f of CARD_METADATA_FIELDS) delete stripped[f];
    stripped.elements = (stripped.elements || []).map(el => {
      const eStripped = { ...el };
      for (const f of ELEMENT_METADATA_FIELDS) delete eStripped[f];
      return eStripped;
    });
    return stripped;
  });
}

// Where the default text box below lands: the top-left corner of the
// safe-zone guide, spanning its full width left to right.
const SAFE_ZONE_PCT = (SAFE_ZONE_INSET / REFERENCE_CARD_SIZE) * 100;

// Every fresh card — the story's first card and every card added afterward
// — starts with one default text box already in place, ready to type into
// immediately instead of an empty canvas. If it's never typed into,
// purgeEmptyText/purgeAllEmptyText strips it back out (card nav, tool
// switch, and right before Publish/Update), so an untouched card never
// actually ships an empty text box.
const newCard = () => ({
  id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  background_color: DEFAULT_CARD_COLOR,
  elements: [{
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'text',
    content: '',
    x: SAFE_ZONE_PCT, y: SAFE_ZONE_PCT, width: 100 - 2 * SAFE_ZONE_PCT,
    font_family: 'Inter',
    font_size: '20',
    font_size_locked: true,
    font_weight: '400',
    font_italic: false, font_underline: false, font_strikethrough: false,
    color: '#000000',
    z_index: 1000,
  }],
});

export default function StoryCreator() {
  // Always "Builder", never the story's own title — stories aren't titled
  // until the publish flow at the end, so there's nothing to show earlier.
  useDocumentTitle('Builder | storywall');
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const editStory = location.state?.editStory;

  // Compute initial cards + tokens from a SINGLE migrateToTokens call so the
  // token IDs in cards.background_token / element.color_token actually exist
  // in the colorTokens array. (Two separate calls generate different IDs,
  // leaving references dangling — the root cause of missing background tokens
  // and text colors not updating.)
  const initialStoryState = useRef(null);
  if (!initialStoryState.current) {
    const initialCards = editStory?.cards?.length ? editStory.cards : [newCard()];
    initialStoryState.current = editStory?.color_tokens?.length
      ? { cards: initialCards, tokens: editStory.color_tokens }
      : migrateToTokens(initialCards, []);
  }
  const [cards, setCards] = useState(initialStoryState.current.cards);
  const [colorTokens, setColorTokens] = useState(initialStoryState.current.tokens);
  const baselineContentRef = useRef(null);
  if (!baselineContentRef.current) {
    baselineContentRef.current = {
      cards: JSON.parse(JSON.stringify(initialStoryState.current.cards)),
      colorTokens: JSON.parse(JSON.stringify(initialStoryState.current.tokens)),
    };
  }
  const [editingPostId, setEditingPostId] = useState(editStory?.id || null);
  const [draftId, setDraftId] = useState(editStory?.status === 'draft' ? (editStory?.id || null) : null);
  const [initialTitle, setInitialTitle] = useState(editStory?.title || '');
  const [initialTags, setInitialTags] = useState(editStory?.tags || []);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [activeTool, setActiveTool] = useState(editStory ? 'text' : 'cards');
  // Track whether the Cards tab has been visited at least once this session.
  // The first Cards visit for a new story defaults to Templates; every
  // subsequent visit defaults to Gallery (the all-cards overview).
  const cardsTabVisitedRef = useRef(false);
  useEffect(() => { if (activeTool === 'cards') cardsTabVisitedRef.current = true; }, [activeTool]);
  const [showPostFlow, setShowPostFlow] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [autoEditId, setAutoEditId] = useState(null);
  // Bumped every time a new card is created. Every tool panel (Text, Media,
  // Cards) watches this and force-resets to its own Gallery tab the next
  // time it's opened — overriding the normal rule that a panel's tab
  // persists independent of which card you're on. Ordinary card navigation
  // (switching between existing cards) does NOT touch this, so that
  // persistence rule still holds everywhere except right after creation.
  const [cardResetToken, setCardResetToken] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState(null);
  const [appliedDraftId, setAppliedDraftId] = useState(null);

  // AI Carousel Builder (Generate mode)
  const generateMode = aiCarouselBuilderEnabled && (location.state?.mode === 'generate' || !!editStory?.raw_notes);
  const [generatePhase, setGeneratePhase] = useState(generateMode && !editStory?.ai_generated ? 'notes' : 'done');
  const [rawNotes, setRawNotes] = useState(editStory?.raw_notes || '');
  const [attachments, setAttachments] = useState([]);
  const [genProgress, setGenProgress] = useState({ completedSteps: 0, totalSteps: 1, label: '' });
  const [showRegenerateChoice, setShowRegenerateChoice] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(!!editStory?.ai_generated);
  const [generationStyle, setGenerationStyle] = useState(editStory?.generation_style || null);

  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 390;
  // The sizes above are read on every render, but nothing used to re-render
  // on a window resize — so a desktop card kept the size it had when the
  // page first drew. Re-render on resize for desktop-width windows and on any
  // width change (rotation, crossing the breakpoint). A height-only change on
  // a phone (keyboard opening, URL bar) deliberately doesn't force one, to
  // keep the mobile card exactly as it has always behaved.
  const [, forceResizeRender] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let lastW = window.innerWidth;
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= DESKTOP_BREAKPOINT || w !== lastW) forceResizeRender();
      lastW = w;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Island constraints — no nav row anymore, just chrome
  const islandMinH = ISLAND_CHROME + 40;
  const islandMaxH = screenH - TOP_BAR_HEIGHT - Math.round(screenW * CARD_MIN_RATIO) - 24;

  // Default: card at ~56% width → island fills remaining
  const defaultCardSize = Math.round(screenW * 0.73);
  const defaultIslandH = clamp(screenH - TOP_BAR_HEIGHT - defaultCardSize - 16, islandMinH, islandMaxH);

  const [islandHeight, setIslandHeight] = useState(defaultIslandH);
  const islandHeightRef = useRef(islandHeight);
  islandHeightRef.current = islandHeight;

  // Must match Tailwind's md breakpoint (768px), which switches the layout
  // to panel-left. It used to be 769, so at exactly 768px (a common tablet
  // width) the desktop layout got the phone card size: far too big.
  const isDesktop = screenW >= DESKTOP_BREAKPOINT;

  const availableForCard = screenH - TOP_BAR_HEIGHT - islandHeight - 16;
  // Desktop: the card takes ~56% of the window height, limited by the width
  // right of the panel, and shrinks with the window down to about the mobile
  // card's size. DESKTOP_CARD_MAX is the size in Oz's reference layout (15.6"
  // laptop, ~1560x780 window): the biggest it should ever get, so it stops
  // growing on larger screens. Mobile sizing is untouched.
  const cardSize = isDesktop
    ? clamp(Math.round(Math.min(screenH * 0.56, (screenW - DESKTOP_PANEL_WIDTH) * 0.6)), DESKTOP_CARD_MIN, DESKTOP_CARD_MAX)
    // Phone layout: unchanged for phones; on wider portrait screens (small
    // tablets) it's capped at the same maximum as desktop.
    : Math.min(DESKTOP_CARD_MAX, clamp(availableForCard, Math.round(screenW * CARD_MIN_RATIO), Math.round(screenW * CARD_MAX_RATIO)));
  // Desktop optical balance: centre the card + add-card button as one group
  // (the button hangs ADD_CARD_REACH px off the card's right side), and sit
  // it a little above the middle of the WINDOW rather than of the area under
  // the top bar.
  const desktopCardShift = isDesktop
    ? `translate(${-ADD_CARD_REACH / 2}px, ${-Math.round(TOP_BAR_HEIGHT / 2 + screenH * 0.02)}px)`
    : undefined;

  const currentCard = cards[currentCardIndex];

  const updateCurrentCard = useCallback((updates) => {
    setCards((prev) => prev.map((c, i) => i === currentCardIndex ? { ...c, ...updates } : c));
  }, [currentCardIndex]);

  // Matched by element id across ALL cards, not just the current one. A text
  // box's final typed content can be committed a beat after the user has
  // already switched to (or created) another card — on deselect/unmount, see
  // DraggableElement.jsx — and binding this to currentCardIndex silently
  // dropped that write, losing whatever was typed since the last blur.
  const updateElement = useCallback((elementId, updates) => {
    setCards((prev) => prev.map((c) => {
      if (!c.elements?.some((el) => el.id === elementId)) return c;
      return { ...c, elements: c.elements.map((el) => el.id === elementId ? { ...el, ...updates } : el) };
    }));
  }, []);

  // Retry image generation for a card whose AI image generation failed.
  // Re-runs generateImage with the stored prompt and adds the background
  // image element on success, or re-marks the card as failed on error.
  const handleRetryImageGeneration = useCallback(async (card) => {
    if (!card?.imagePrompt) return;
    const cardIndex = cards.findIndex(c => c.id === card.id);
    if (cardIndex < 0) return;

    setCards(prev => prev.map((c, i) => i === cardIndex ? { ...c, imageGenerationFailed: false, imageRetrying: true } : c));

    try {
      const imgRes = await base44.functions.invoke('generateImage', { prompt: card.imagePrompt });
      const imageUrl = imgRes?.data?.url;
      if (imageUrl) {
        const isInset = card.photoTreatment === 'inset';
        const bgEl = isInset ? {
          id: `${card.id}-bg-retry-${Date.now()}`,
          type: 'image',
          image_url: imageUrl,
          crop_ratio: 'original',
          x: 10, y: 5,
          displayWidth: 256,
          displayHeight: 144,
          z_index: 0,
          ai_generated: true,
        } : {
          id: `${card.id}-bg-retry-${Date.now()}`,
          type: 'image',
          image_url: imageUrl,
          crop_ratio: 'original',
          x: 0, y: 0,
          displayWidth: REFERENCE_CARD_SIZE, displayHeight: REFERENCE_CARD_SIZE,
          clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0,
          z_index: 0,
          ai_generated: true,
          overlay_type: 'Color',
          overlay_color: resolveColor(card.background_token, colorTokensRef.current, card.background_color || '#171208'),
          overlay_position: 'Bottom',
          overlay_intensity: 80,
        };
        const textEls = (card.elements || []).filter(e => e.type === 'text');
        setCards(prev => prev.map((c, i) => i === cardIndex ? {
          ...c,
          elements: [bgEl, ...textEls],
          backgroundImageId: bgEl.id,
          imageRetrying: false,
        } : c));

        try {
          await registerMedia({ image_url: imageUrl, media_type: 'image' });
        } catch {}
      } else {
        setCards(prev => prev.map((c, i) => i === cardIndex ? { ...c, imageGenerationFailed: true, imageRetrying: false } : c));
      }
    } catch (e) {
      console.error('[retry] image generation failed:', e?.message || e);
      setCards(prev => prev.map((c, i) => i === cardIndex ? { ...c, imageGenerationFailed: true, imageRetrying: false } : c));
    }
  }, [cards]);

  const addElement = useCallback((element) => {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const els = currentCard.elements || [];
    const sameType = els.filter((e) => e.type === element.type);
    // Cascading offset: 5% (≈16px at 320px reference) right & down per same-type element
    const baseX = element.x ?? (element.type === 'text' ? 10 : 20);
    const baseY = element.y ?? 20;
    const x = Math.min(60, baseX + sameType.length * 5);
    const y = Math.min(70, baseY + sameType.length * 5);

    let z_index;
    if (element.type !== 'text') {
      // Media namespace (image/video/audio): 1-999. Background ('fill') sits at z=0.
      const mediaZs = els.filter((e) => e.type !== 'text').map((e) => e.z_index ?? 1);
      const maxMediaZ = mediaZs.length ? Math.max(...mediaZs) : 0;
      z_index = Math.min(999, Math.max(1, maxMediaZ + 1));
    } else {
      // Text namespace: 1000+ — always above every media element.
      const textZs = els.filter((e) => e.type === 'text').map((e) => e.z_index ?? 1000);
      const maxTextZ = textZs.length ? Math.max(...textZs) : 0;
      z_index = Math.max(1000, maxTextZ + 1);
    }

    const newEl = { ...element, id, x, y, z_index };
    updateCurrentCard({ elements: [...els, newEl] });
    setSelectedElementId(id);
    // New text boxes should be immediately typeable (keyboard up on mobile),
    // not just selected — selection alone only shows the resize handles.
    if (element.type === 'text') setAutoEditId(id);
    return id;
  }, [currentCard, updateCurrentCard]);

  const selectElement = useCallback((id) => {setSelectedElementId(id);}, []);

  const deleteElement = useCallback((elementId) => {
    setCards((prev) => prev.map((c) => {
    const wasBg = c.backgroundImageId === elementId;
    if (!wasBg && !c.elements?.some(e => e.id === elementId)) return c;
    return {
      ...c,
      elements: c.elements.filter((e) => e.id !== elementId),
      backgroundImageId: wasBg ? undefined : c.backgroundImageId,
    };
    }));
    setSelectedElementId(null);
  }, []);

  // Remove all elements with the given image_url from every card (used by
  // the Media gallery's delete action, which is now story-scoped).
  const removeMediaByUrl = useCallback((imageUrl) => {
    setCards((prev) => prev.map((c) => {
      const elements = (c.elements || []).filter(e => e.image_url !== imageUrl);
      const bgId = c.backgroundImageId;
      const bgStillExists = bgId && elements.some(e => e.id === bgId);
      return {
        ...c,
        elements,
        backgroundImageId: bgStillExists ? bgId : undefined,
      };
    }));
  }, []);

  const duplicateElement = useCallback((element) => {
    const { id, ...rest } = element;
    const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Offset slightly so the duplicate is visible
    const x = Math.min(80, (element.x ?? 16) + 5);
    const y = Math.min(80, (element.y ?? 16) + 5);
    const zOrig = element.z_index ?? (element.type === 'text' ? 1000 : 1);
    const zIndex = element.type === 'text' ? Math.max(1000, zOrig + 1) : Math.min(999, zOrig + 1);
    const newEl = { ...rest, id: newId, x, y, z_index: zIndex };
    const cardIdx = cards.findIndex(c => c.elements?.some(e => e.id === element.id));
    if (cardIdx < 0) return;
    setCards((prev) => prev.map((c, i) => i === cardIdx ? { ...c, elements: [...c.elements, newEl] } : c));
    setCurrentCardIndex(cardIdx);
    setSelectedElementId(newId);
  }, [cards]);

  // Places a copy of `element` onto an arbitrary target card (not
  // necessarily the one it currently lives on) — the "Add to card" action
  // in the Media/Text gallery kebabs, which replaced plain same-card
  // Duplicate there. Navigates to that card and selects the new copy, same
  // as every other add-a-new-element path in this file.
  const duplicateElementToCard = useCallback((element, targetCardIndex) => {
    const { id, ...rest } = element;
    const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const targetEls = cards[targetCardIndex]?.elements || [];
    const x = element.x ?? (element.type === 'text' ? 10 : 20);
    const y = element.y ?? 20;
    let z_index;
    if (element.type !== 'text') {
      const mediaZs = targetEls.filter((e) => e.type !== 'text').map((e) => e.z_index ?? 1);
      z_index = Math.min(999, (mediaZs.length ? Math.max(...mediaZs) : 0) + 1);
    } else {
      const textZs = targetEls.filter((e) => e.type === 'text').map((e) => e.z_index ?? 1000);
      z_index = Math.max(1000, (textZs.length ? Math.max(...textZs) : 0) + 1);
    }
    const newEl = { ...rest, id: newId, x, y, z_index };
    setCards((prev) => prev.map((c, i) => i === targetCardIndex ? { ...c, elements: [...(c.elements || []), newEl] } : c));
    setCurrentCardIndex(targetCardIndex);
    setSelectedElementId(newId);
    return newId;
  }, [cards]);

  const reorderTextElements = useCallback((orderedIds) => {
    setCards((prev) => prev.map((c, i) => {
      if (i !== currentCardIndex) return c;
      const textById = {};
      const others = [];
      for (const el of c.elements) {
        if (el.type === 'text') textById[el.id] = el;else
        others.push(el);
      }
      const orderedText = orderedIds.map((tid) => textById[tid]).filter(Boolean);
      return { ...c, elements: [...others, ...orderedText] };
    }));
  }, [currentCardIndex]);

  // Remove empty (never-typed) text elements from a card — used when leaving the
  // text context (card nav, tool switch, post, leave).
  const purgeEmptyText = useCallback((cardIndex) => {
    setCards((prev) => prev.map((c, i) => {
      if (i !== cardIndex) return c;
      return { ...c, elements: (c.elements || []).filter(el => el.type !== 'text' || !!(el.content && el.content.trim())) };
    }));
  }, []);

  const purgeAllEmptyText = useCallback(() => {
    setCards((prev) => prev.map(c => ({
      ...c,
      elements: (c.elements || []).filter(el => el.type !== 'text' || !!(el.content && el.content.trim())),
    })));
  }, []);

  const navigateCard = useCallback((dir) => {
    setCurrentCardIndex((i) => Math.max(0, Math.min(cards.length - 1, i + dir)));
    setSelectedElementId(null);
  }, [currentCardIndex, cards.length]);

  const handleToolChange = useCallback((tool) => {
    setActiveTool(tool);
    setSelectedElementId(null);
  }, []);

  const deleteCard = (index) => {
    if (cards.length === 1) {
      const { token, tokens: newTokens } = findOrCreateToken(DEFAULT_CARD_COLOR, colorTokens);
      if (newTokens.length > colorTokens.length) setColorTokens(newTokens);
      setCards([{ ...newCard(), background_token: token.id }]);
      return;
    }
    const next = cards.filter((_, i) => i !== index);
    setCards(next);
    setCurrentCardIndex((i) => Math.min(i, next.length - 1));
    setSelectedElementId(null);
  };

  const duplicateCard = (index) => {
    const src = cards[index];
    const idMap = {};
    const newElements = (src.elements || []).map((el) => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      idMap[el.id] = newId;
      return { ...el, id: newId };
    });
    const copy = {
      ...src,
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      elements: newElements,
      backgroundImageId: src.backgroundImageId ? idMap[src.backgroundImageId] : undefined,
    };
    const next = [...cards.slice(0, index + 1), copy, ...cards.slice(index + 1)];
    setCards(next);
    setCurrentCardIndex(index + 1);
    setSelectedElementId(null);
  };

  const addCard = () => {
    const { token, tokens: newTokens } = findOrCreateToken(DEFAULT_CARD_COLOR, colorTokens);
    if (newTokens.length > colorTokens.length) setColorTokens(newTokens);
    const c = { ...newCard(), background_token: token.id };
    setCards((prev) => [...prev, c]);
    setCurrentCardIndex(cards.length);
    setSelectedElementId(null);
    // A new card always lands on the Cards gallery, and every panel opens on
    // its own gallery the next time it's visited for this card.
    setActiveTool('cards');
    setCardResetToken((t) => t + 1);
  };

  const reorderCards = (newOrder) => {setCards(newOrder);setCurrentCardIndex(0);};

  // Apply a token color change — story-wide (update token) or card-only (new token).
  // For card-only changes, revert the token to its original color first (the
  // live preview modified it to show the change on the current card).
  const handleApplyTokenColor = useCallback(({ tokenId, newColor, storyWide, originalColor }) => {
    let tokens = colorTokensRef.current;
    // Revert the live-preview color change on the original token for BOTH
    // story-wide and card-only commits. Story-wide now reassigns the role to
    // a fresh dedicated token (see applyTokenColorChange), so the original
    // token must be restored to its pre-preview color to avoid recoloring
    // any other roles that happen to reference it on other cards.
    if (originalColor) {
      tokens = tokens.map(t => t.id === tokenId ? { ...t, color: originalColor } : t);
    }
    const result = applyTokenColorChange({
      cards: cardsRef.current,
      tokens,
      cardIndex: currentCardIndex,
      tokenId,
      newColor,
      storyWide,
    });
    setCards(result.cards);
    setColorTokens(result.tokens);
    // Both story-wide and card-only commits create a new dedicated token —
    // return its ID so the caller can track the token the card now uses.
    const newToken = result.tokens.find(t => !tokens.some(old => old.id === t.id));
    return newToken?.id || tokenId;
  }, [currentCardIndex]);

  // Live preview: update the token color so the card visually updates in real time.
  // The token is committed (or reverted + new token created) on drag end via onCommit.
  const handlePreviewColor = useCallback(({ tokenId, newColor }) => {
    setColorTokens(prev => prev.map(t => t.id === tokenId ? { ...t, color: newColor } : t));
  }, []);

  const handleSetTokens = useCallback((newTokens) => {
    setColorTokens(newTokens);
  }, []);

  const selectedElement = currentCard?.elements?.find((e) => e.id === selectedElementId) || null;

  // Keyboard delete: Delete/Backspace removes the selected canvas element,
  // matching the on-screen delete control. Ignored while typing in any
  // input, textarea, or contentEditable so text editing isn't disrupted.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (!selectedElementId) return;
      e.preventDefault();
      deleteElement(selectedElementId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, deleteElement]);

  // Dev-only: detect canvas elements that leaked outside their card container (DOM leak guard)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const orphans = Array.from(document.querySelectorAll('[data-canvas-el]')).filter(
      (el) => !el.closest('[data-card-canvas]')
    );
    if (orphans.length) {
      console.warn('[StoryCreator] Orphaned canvas elements detected outside card container:', orphans);
    }
  }, [currentCardIndex, showPostFlow]);

  // Lock body scroll while the creator is active; restore on unmount.
  // The creator root uses overflow-hidden + 100dvh so it never scrolls itself;
  // this prevents the body from scrolling behind it. Island panel content
  // has its own overflow-y-auto for independent internal scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Best-effort back-navigation intercept: push a dummy state on mount so we
  // can catch popstate (browser back / edge-swipe-back) and show the unsaved-
  // changes confirmation instead of navigating away immediately. The user
  // must confirm before the navigation actually proceeds. Note: this is
  // reliable for a clicked back button but less reliable for iOS Safari edge-
  // swipe-back, where the OS may render a visual "peek" before JS runs.
  useEffect(() => {
    window.history.pushState({ unsavedGuard: true }, '');
    const handlePopState = async () => {
      window.history.pushState({ unsavedGuard: true }, '');
      await flushActiveTextEditRef.current?.();
      firePersist();
      navigateToProfileRef.current?.();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleIslandDrag = useCallback((newH) => {
    setIslandHeight(clamp(newH, islandMinH, islandMaxH));
  }, [islandMinH, islandMaxH]);

  // Refs keep the latest state so the debounced autosave closure always reads
  // current values without re-creating the callback on every edit.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  const rawNotesRef = useRef(rawNotes);
  rawNotesRef.current = rawNotes;
  const aiGeneratedRef = useRef(aiGenerated);
  aiGeneratedRef.current = aiGenerated;
  const generationStyleRef = useRef(generationStyle);
  generationStyleRef.current = generationStyle;
  const colorTokensRef = useRef(colorTokens);
  colorTokensRef.current = colorTokens;
  // baselineContent model: dirty is computed fresh as a deep comparison of
  // currentContent (cards + colorTokens) vs baselineContent. No flag is stored.
  // resetBaseline snapshots the given (or current) content as the new clean ref.
  const resetBaseline = useCallback((newCards, newTokens) => {
    baselineContentRef.current = {
      cards: JSON.parse(JSON.stringify(newCards || cardsRef.current)),
      colorTokens: JSON.parse(JSON.stringify(newTokens || colorTokensRef.current)),
    };
  }, []);

  const navigateToProfileRef = useRef(null);
  const flushActiveTextEditRef = useRef(null);

  // ── Undo/Redo ──
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const skipHistoryRef = useRef(true);
  const committedSnapshotRef = useRef({ cards, colorTokens, activeTool, currentCardIndex, draftId, editingPostId, initialTitle, initialTags, appliedTemplateId, appliedDraftId });
  const historyDebounceRef = useRef(null);

  // Refs for flushHistory — reads current state outside the effect closure
  const activeToolRef = useRef(activeTool); activeToolRef.current = activeTool;
  const currentCardIndexRef = useRef(currentCardIndex); currentCardIndexRef.current = currentCardIndex;
  const editingPostIdRef = useRef(editingPostId); editingPostIdRef.current = editingPostId;
  const initialTitleRef = useRef(initialTitle); initialTitleRef.current = initialTitle;
  const initialTagsRef = useRef(initialTags); initialTagsRef.current = initialTags;
  const appliedTemplateIdRef = useRef(appliedTemplateId); appliedTemplateIdRef.current = appliedTemplateId;
  const appliedDraftIdRef = useRef(appliedDraftId); appliedDraftIdRef.current = appliedDraftId;

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      committedSnapshotRef.current = { cards, colorTokens, activeTool, currentCardIndex, draftId, editingPostId, initialTitle, initialTags, appliedTemplateId, appliedDraftId };
      return;
    }
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      const prev = committedSnapshotRef.current;
      if (prev.cards === cards && prev.colorTokens === colorTokens && prev.activeTool === activeTool && prev.currentCardIndex === currentCardIndex && prev.draftId === draftId && prev.editingPostId === editingPostId && prev.initialTitle === initialTitle && prev.initialTags === initialTags && prev.appliedTemplateId === appliedTemplateId && prev.appliedDraftId === appliedDraftId) return;
      undoStackRef.current.push(prev);
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
      committedSnapshotRef.current = { cards, colorTokens, activeTool, currentCardIndex, draftId, editingPostId, initialTitle, initialTags, appliedTemplateId, appliedDraftId };
      setCanUndo(true);
      setCanRedo(false);
    }, 600);
    return () => { if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current); };
  }, [cards, colorTokens, activeTool, currentCardIndex, draftId, editingPostId, initialTitle, initialTags, appliedTemplateId, appliedDraftId]);

  const flushHistory = useCallback(() => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
      const prev = committedSnapshotRef.current;
      const curr = { cards: cardsRef.current, colorTokens: colorTokensRef.current, activeTool: activeToolRef.current, currentCardIndex: currentCardIndexRef.current, draftId: draftIdRef.current, editingPostId: editingPostIdRef.current, initialTitle: initialTitleRef.current, initialTags: initialTagsRef.current, appliedTemplateId: appliedTemplateIdRef.current, appliedDraftId: appliedDraftIdRef.current };
      if (prev.cards !== curr.cards || prev.colorTokens !== curr.colorTokens || prev.activeTool !== curr.activeTool || prev.currentCardIndex !== curr.currentCardIndex || prev.draftId !== curr.draftId || prev.editingPostId !== curr.editingPostId || prev.initialTitle !== curr.initialTitle || prev.initialTags !== curr.initialTags || prev.appliedTemplateId !== curr.appliedTemplateId || prev.appliedDraftId !== curr.appliedDraftId) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        committedSnapshotRef.current = curr;
        setCanUndo(true);
        setCanRedo(false);
      }
    }
  }, []);

  const handleUndo = useCallback(() => {
    flushHistory();
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop();
    redoStackRef.current.push(committedSnapshotRef.current);
    skipHistoryRef.current = true;
    setCards(prev.cards);
    setColorTokens(prev.colorTokens);
    setActiveTool(prev.activeTool);
    setCurrentCardIndex(prev.currentCardIndex);
    setDraftId(prev.draftId);
    setEditingPostId(prev.editingPostId);
    setInitialTitle(prev.initialTitle);
    setInitialTags(prev.initialTags);
    setAppliedTemplateId(prev.appliedTemplateId);
    setAppliedDraftId(prev.appliedDraftId);
    setSelectedElementId(null);
    committedSnapshotRef.current = prev;
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [flushHistory]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(committedSnapshotRef.current);
    skipHistoryRef.current = true;
    setCards(next.cards);
    setColorTokens(next.colorTokens);
    setActiveTool(next.activeTool);
    setCurrentCardIndex(next.currentCardIndex);
    setDraftId(next.draftId);
    setEditingPostId(next.editingPostId);
    setInitialTitle(next.initialTitle);
    setInitialTags(next.initialTags);
    setAppliedTemplateId(next.appliedTemplateId);
    setAppliedDraftId(next.appliedDraftId);
    setSelectedElementId(null);
    committedSnapshotRef.current = next;
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Save-only persistence — no modal close, no navigate. Reused by both the
  // explicit leave-modal save and the debounced autosave. Snapshots raw cards
  // state as-is (no empty-text cleanup — that stays scoped to its existing
  // trigger points: navigate away, tool switch, tap Post, tap profile icon).
  const isPersistingRef = useRef(false);
  const inFlightRef = useRef(null);
  // A save requested while another is still in flight used to be silently
  // dropped (it just returned the in-flight promise); now it re-runs once the
  // in-flight one finishes, with fresh state.
  const rerunPersistRef = useRef(false);
  const persistDraftRef = useRef(null);
  // Bumped whenever the builder swaps to a different stored story (opening a
  // draft). A save of the PREVIOUS story still finishing in the background
  // checks this so it never adopts its newly-created row id, or resets the
  // dirty baseline, for the story that's now on screen.
  const storyEpochRef = useRef(0);
  // auth.me() cached for the session — only needed to create a new draft row.
  const userPromiseRef = useRef(null);
  const getUser = useCallback(() => {
    if (!userPromiseRef.current) {
      userPromiseRef.current = base44.auth.me().catch((e) => { userPromiseRef.current = null; throw e; });
    }
    return userPromiseRef.current;
  }, []);
  const persistDraft = useCallback(() => {
    if (isPersistingRef.current) { rerunPersistRef.current = true; return inFlightRef.current; }
    isPersistingRef.current = true;
    // Snapshot everything synchronously, BEFORE any await. Opening a draft
    // now kicks this off for the story being left and swaps state right
    // away without waiting — reading the refs after an await would save the
    // NEW story's content into the OLD story's row.
    const epoch = storyEpochRef.current;
    const currentDraftId = draftIdRef.current;
    const currentCards = cardsRef.current;
    const currentTokens = colorTokensRef.current;
    const snapRawNotes = rawNotesRef.current;
    const snapAiGenerated = aiGeneratedRef.current;
    const snapGenerationStyle = generationStyleRef.current;
    const p = (async () => {
      try {
        // A media element still shows its optimistic local preview (a blob:
        // URL from a picked file whose upload hasn't finished yet) — that URL
        // is only valid in this browser tab, so persisting it would leave a
        // permanently-broken image if the draft were reloaded before the
        // upload finishes. Skip this save; swapping in the real uploaded URL
        // changes `cards` too, which reschedules autosave and retries.
        const hasPendingBlobMedia = (currentCards || []).some((c) =>
          (c?.elements || []).some((el) => typeof el?.image_url === 'string' && el.image_url.startsWith('blob:'))
        );
        if (hasPendingBlobMedia) return null;
        if (currentDraftId) {
          await base44.entities.Post.update(currentDraftId, {
            cards: currentCards,
            color_tokens: currentTokens,
            status: 'draft',
            ...(snapRawNotes ? { raw_notes: snapRawNotes } : {}),
            ...(snapAiGenerated ? { ai_generated: true } : {}),
            ...(snapGenerationStyle ? { generation_style: snapGenerationStyle } : {}),
          });
          // Only reset the baseline if the content hasn't changed (canonically)
          // while the save was in flight. Uses canonical comparison instead of
          // reference comparison so a metadata-load array swap (same canonical
          // values, new array) doesn't prevent a legitimate reset, and a real
          // edit (different canonical values) is never silently baseline-reset.
          if (storyEpochRef.current === epoch &&
              JSON.stringify(canonicalize(cardsRef.current)) === JSON.stringify(canonicalize(currentCards)) &&
              JSON.stringify(colorTokensRef.current) === JSON.stringify(currentTokens)) {
            resetBaseline(currentCards, currentTokens);
          }
          return currentDraftId;
        } else {
          if (!hasRealContent(currentCards)) return null;
          const user = await getUser();
          const created = await base44.entities.Post.create({
            author_id: user.id,
            author_username: user.username || '',
            title: '',
            tags: [],
            cards: currentCards,
            color_tokens: currentTokens,
            status: 'draft',
            ...(snapRawNotes ? { raw_notes: snapRawNotes } : {}),
            ...(snapAiGenerated ? { ai_generated: true } : {}),
            ...(snapGenerationStyle ? { generation_style: snapGenerationStyle } : {}),
          });
          if (storyEpochRef.current === epoch) {
            setDraftId(created.id);
            draftIdRef.current = created.id;
            if (JSON.stringify(canonicalize(cardsRef.current)) === JSON.stringify(canonicalize(currentCards)) &&
                JSON.stringify(colorTokensRef.current) === JSON.stringify(currentTokens)) {
              resetBaseline(currentCards, currentTokens);
            }
          }
          return created.id;
        }
      } catch (e) {
        console.error(e);
      } finally {
        isPersistingRef.current = false;
        inFlightRef.current = null;
        if (rerunPersistRef.current) {
          rerunPersistRef.current = false;
          persistDraftRef.current?.();
        }
      }
    })();
    inFlightRef.current = p;
    return p;
  }, [getUser]);
  persistDraftRef.current = persistDraft;

  // Autosave timers: debounce 4s after last edit, 30s ceiling for continuous editing.
  const DEBOUNCE_MS = 4000;
  const CEILING_MS = 30000;
  const debounceTimerRef = useRef(null);
  const ceilingTimerRef = useRef(null);

  const clearAutosaveTimers = useCallback(() => {
    if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    if (ceilingTimerRef.current) { clearTimeout(ceilingTimerRef.current); ceilingTimerRef.current = null; }
  }, []);

  const firePersist = useCallback(() => {
    clearAutosaveTimers();
    persistDraft();
  }, [clearAutosaveTimers, persistDraft]);

  // Typed text only reaches `cards` when its box blurs, and many ways of
  // "moving on" never blur it (especially on mobile, where tapping a button
  // or non-focusable area often leaves the contentEditable focused). Before
  // any LEAVING save — backgrounding the tab, closing, back, profile, Post,
  // applying a template/draft — blur the active text box so it commits, then
  // wait one tick so React applies that update and cardsRef reflects it
  // before persistDraft reads it. Deliberately NOT used by the debounced
  // autosave, which would otherwise kick the user out of a box mid-typing.
  const flushActiveTextEdit = useCallback(() => {
    const active = document.activeElement;
    if (active && active.isContentEditable) {
      active.blur();
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    return Promise.resolve();
  }, []);
  flushActiveTextEditRef.current = flushActiveTextEdit;

  const flushAndPersist = useCallback(() => {
    flushActiveTextEdit().then(firePersist);
  }, [flushActiveTextEdit, firePersist]);

  // Cancel pending autosave timers AND wait for any in-flight save to finish.
  // Used by the explicit leave-modal save and the publish action so two writes
  // never race (e.g. a late autosave reverting a publish's status back to draft).
  const cancelAutosave = useCallback(async () => {
    clearAutosaveTimers();
    if (inFlightRef.current) await inFlightRef.current;
  }, [clearAutosaveTimers]);

  const scheduleAutosave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(firePersist, DEBOUNCE_MS);
    if (!ceilingTimerRef.current) {
      ceilingTimerRef.current = setTimeout(firePersist, CEILING_MS);
    }
  }, [firePersist]);

  // Debounce autosave on meaningful edits (any cards state change); skip the
  // initial mount so loading a story doesn't immediately create/update a row.
  const skipFirstAutosave = useRef(true);
  useEffect(() => {
    if (skipFirstAutosave.current) { skipFirstAutosave.current = false; return; }
    scheduleAutosave();
  }, [cards, colorTokens, scheduleAutosave]);

  const skipFirstNotesAutosave = useRef(true);
  useEffect(() => {
    if (!generateMode || generatePhase !== 'notes') return;
    if (skipFirstNotesAutosave.current) { skipFirstNotesAutosave.current = false; return; }
    scheduleAutosave();
  }, [rawNotes, attachments, generateMode, generatePhase, scheduleAutosave]);

  // Supplementary trigger: save when the tab is backgrounded. Also cleans up
  // timers and listener on unmount.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushAndPersist(); };
    const onBeforeUnload = () => { flushAndPersist(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearAutosaveTimers();
    };
  }, [flushAndPersist, clearAutosaveTimers]);

  const [currentUser, setCurrentUser] = useState(null);
  // Load current user for navigation back to profile
  useEffect(() => {
    base44.auth.me().then((u) => setCurrentUser(u)).catch(() => {});
  }, []);

  // Navigate to the user's profile — falls back to a fresh me() call if
  // currentUser hasn't loaded yet (e.g. very fast interaction after mount).
  const navigateToProfile = useCallback(async () => {
    let username = currentUser?.username;
    if (!username) {
      try {
        const u = await base44.auth.me();
        username = u?.username;
      } catch {}
    }
    navigate(username ? `/${username}` : '/');
  }, [currentUser, navigate]);
  navigateToProfileRef.current = navigateToProfile;

  // ── Apply content (shared by Templates and Drafts) ──
  // applyTemplateContent / applyDraftContent do the actual content replacement
  // and reset the baseline. handleApplyTemplate / handleApplyDraft gate on
  // isDirty: if clean, apply immediately; if dirty, show the confirmation modal.

  const applyTemplateContent = useCallback(async (template, cardIndex = 0) => {
    await flushActiveTextEdit();
    await cancelAutosave();
    // The template replaces the whole story, so the current one must be safely
    // stored first. If that save failed (offline) or was skipped (a photo still
    // uploading), keep the story on screen and say so instead of losing it.
    const savedId = await persistDraft();
    if (!savedId && hasRealContent(cardsRef.current)) {
      toast({
        variant: 'destructive',
        title: "Couldn't save your story",
        description: 'Your story is still here. Wait for uploads to finish or check your connection, then try the template again.',
      });
      return;
    }
    const newCards = applyTemplateToStory(template, cardsRef.current, true);
    const { cards: migratedCards, tokens: migratedTokens } = migrateToTokens(newCards, colorTokensRef.current);
    // A template replaces every card, so it starts a NEW story: detach from
    // the draft (or published story) that was open. The story being left was
    // just saved above and stays in Drafts untouched. Without this, the next
    // autosave wrote the template's cards into the old story's draft row and
    // the user's work was lost; and Post would have overwritten the published
    // story being edited. The epoch bump stops a save of the old story that's
    // still finishing from adopting ids or baselines for this one (same as
    // opening a draft).
    storyEpochRef.current += 1;
    setDraftId(null);
    draftIdRef.current = null;
    setEditingPostId(null);
    setInitialTitle('');
    setInitialTags([]);
    setCards(migratedCards);
    setColorTokens(migratedTokens);
    setCurrentCardIndex(Math.min(cardIndex, migratedCards.length - 1));
    setSelectedElementId(null);
    setAppliedTemplateId(template.id);
    setAppliedDraftId(null);
    resetBaseline(migratedCards, migratedTokens);

    try {
      const user = await base44.auth.me();
      if (user?.id) {
        const seen = new Set();
        for (const c of migratedCards) {
          for (const el of (c.elements || [])) {
            if ((el.type === 'image' || el.type === 'video') && el.image_url && !seen.has(el.image_url)) {
              seen.add(el.image_url);
              try {
                await registerMedia({
                  image_url: el.image_url,
                  media_type: el.type === 'video' ? 'video' : 'image',
                });
              } catch (e) {
                console.error('Template media save failed:', e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Template media save failed:', e);
    }
  }, [flushActiveTextEdit, cancelAutosave, persistDraft, resetBaseline, toast]);

  const applyDraftContent = useCallback(async (draft, cardIndex = 0) => {
    // Tapping the draft that's already open: just jump to the card. Reloading
    // it would swap in the Drafts list's copy, which can be older than what's
    // on screen, and throw away edits made since the list was fetched.
    if (draft.id && draft.id === draftIdRef.current) {
      setCurrentCardIndex(Math.max(0, Math.min(cardIndex, cardsRef.current.length - 1)));
      setSelectedElementId(null);
      return;
    }
    setLoadingDraft(true);
    try {
      await flushActiveTextEdit();
      await cancelAutosave();
      // Save the story being left in the BACKGROUND instead of blocking the
      // open on it (previously auth.me + Post.update, two sequential network
      // round trips, before anything changed on screen). persistDraft
      // snapshots its content synchronously, and the epoch bump below keeps
      // that background save from touching the draft being opened.
      persistDraft();
      storyEpochRef.current += 1;
      const { cards: migratedCards, tokens: migratedTokens } = migrateToTokens(draft.cards || [newCard()], draft.color_tokens || []);
      setCards(migratedCards);
      setColorTokens(migratedTokens);
      setCurrentCardIndex(Math.min(cardIndex, migratedCards.length - 1));
      setSelectedElementId(null);
      setDraftId(draft.id);
      draftIdRef.current = draft.id;
      setEditingPostId(draft.id);
      setInitialTitle(draft.title || '');
      setInitialTags(draft.tags || []);
      setAppliedDraftId(draft.id);
      setAppliedTemplateId(null);
      resetBaseline(migratedCards, migratedTokens);
    } finally {
      setLoadingDraft(false);
    }
  }, [flushActiveTextEdit, cancelAutosave, persistDraft, resetBaseline]);

  const handleApplyTemplate = useCallback((template, cardIndex) => {
    applyTemplateContent(template, cardIndex);
  }, [applyTemplateContent]);

  const handleApplyDraft = useCallback((draft, cardIndex) => {
    applyDraftContent(draft, cardIndex);
  }, [applyDraftContent]);

  // ── AI Carousel Builder: Generate mode handlers ──

  const handleAddAttachment = async (file) => {
    try {
      const isVideo = file.type.startsWith('video/');
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setAttachments(prev => [...prev, { url: file_url, type: isVideo ? 'video' : 'image' }]);
    } catch (e) {
      console.error('[StoryCreator] attachment upload failed:', e);
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async (editMode = 'full') => {
    if (!rawNotes.trim()) return;
    setGeneratePhase('generating');
    setGenProgress({ completedSteps: 0, totalSteps: 1, label: 'Starting…' });
    try {
      const result = await runGeneratePipeline({
        text: rawNotes,
        attachments,
        editMode,
        existingCards: editMode === 'edits_only' ? cards : [],
        existingStyleTemplate: editMode === 'edits_only' ? generationStyle : undefined,
        onProgress: (p) => setGenProgress(p),
      });
      setCards(result.cards);
      setColorTokens(result.tokens || []);
      setCurrentCardIndex(0);
      setSelectedElementId(null);
      setAiGenerated(true);
      setGenerationStyle(result.styleTemplate);
      setGeneratePhase('done');
      setShowRegenerateChoice(false);
      resetBaseline(result.cards, result.tokens || []);
    } catch (e) {
      console.error('[StoryCreator] generation failed:', e);
      setGeneratePhase('notes');
    }
  };

  const handleBackToNotes = () => {
    setGeneratePhase('notes');
  };

  const handleOpenPostFlow = useCallback(async () => {
    await flushActiveTextEdit();
    // Strip any text box that was never typed into (most commonly, the
    // default box every fresh card starts with — see newCard() above)
    // before the preview/publish screen and the draft it saves ever see it.
    // Same "wait one tick" reasoning as flushActiveTextEdit above: setCards
    // here doesn't land in cardsRef until React applies it, and persistDraft
    // reads cardsRef synchronously.
    purgeAllEmptyText();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await cancelAutosave();
    await persistDraft();
    setShowPostFlow(true);
  }, [flushActiveTextEdit, purgeAllEmptyText, cancelAutosave, persistDraft]);

  const handleGenerateTap = () => {
    if (aiGenerated) {
      setShowRegenerateChoice(true);
    } else {
      handleGenerate('full');
    }
  };

  // Top-bar pieces (arranged in the TOP BAR below).
  const topProfileButton = (
    <button
      onClick={async () => { await flushActiveTextEdit(); firePersist(); navigateToProfile(); }}
      title="Profile"
      className={`flex-shrink-0 w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors ${generatePhase === 'notes' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/10 hover:bg-white/20'}`}>
      <PerspectiveView size={16} className={generatePhase === 'notes' ? 'text-black/60' : 'text-white/60'} />
    </button>
  );
  const topUndoRedo = generatePhase !== 'notes' && (
    <div className="flex items-center gap-1">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        title="Undo"
        className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors ${canUndo ? 'bg-white/10 hover:bg-white/20' : 'opacity-20 cursor-default'}`}>
        <Undo2 size={16} className="text-white/60" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        title="Redo"
        className={`w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors ${canRedo ? 'bg-white/10 hover:bg-white/20' : 'opacity-20 cursor-default'}`}>
        <Redo2 size={16} className="text-white/60" />
      </button>
    </div>
  );
  const topCounter = generatePhase !== 'notes' ? (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => navigateCard(-1)}
        disabled={currentCardIndex === 0}
        title="Previous card"
        className="p-1 text-white/50 hover:text-white disabled:opacity-20 transition-colors">
        <ChevronLeft size={18} />
      </button>
      <span className="text-white/70 text-sm font-medium tabular-nums">
        {currentCardIndex + 1}/{cards.length}
      </span>
      <button
        onClick={() => navigateCard(1)}
        disabled={currentCardIndex === cards.length - 1}
        title="Next card"
        className="p-1 text-white/50 hover:text-white disabled:opacity-20 transition-colors">
        <ChevronRight size={18} />
      </button>
    </div>
  ) : <div />;
  const topPostArea = generatePhase === 'notes' ? (
    <button
      onClick={handleGenerateTap}
      disabled={!rawNotes.trim()}
      className="bg-black text-white font-semibold text-sm px-4 py-1.5 rounded-[6px] hover:bg-black/90 active:scale-95 transition-all disabled:opacity-40">
      Generate →
    </button>
  ) : generateMode && aiGenerated ? (
    <div className="flex items-center gap-2">
      <button
        onClick={handleBackToNotes}
        className="bg-white/10 text-white/80 font-medium text-sm px-3 py-1.5 rounded-[6px] hover:bg-white/20 transition-all">
        Notes
      </button>
      <button
        onClick={handleOpenPostFlow}
        className="bg-white text-black font-semibold text-sm px-4 py-1.5 rounded-[6px] hover:bg-white/90 active:scale-95 transition-all">
        Post →
      </button>
    </div>
  ) : (
    <button
      onClick={handleOpenPostFlow}
      className="bg-white text-black font-semibold text-sm px-4 py-1.5 rounded-[6px] hover:bg-white/90 active:scale-95 transition-all">
      Post →
    </button>
  );

  return (
  <DraftMediaProvider>
  <div className="flex flex-col overflow-hidden select-none" style={{ height: '100dvh', backgroundColor: '#111' }}>

      {/* TOP BAR: profile | undo/redo | counter | post.
          Laid out with flex/grid rather than fixed offsets so the spacing
          balances itself:
          - Mobile: three columns (1fr | auto | 1fr) — the counter is exactly
            centred on the screen, and undo/redo are centred in the real gap
            between the profile button and the counter's left arrow.
          - Desktop: the same left group spans the panel's width (counter
            ending at its right edge); Post sits at the far right.
          No "Editing story" label, and the button always says Post. Buttons
          are rounded squares (6px), matching the rest of the builder. */}
      <div className="relative flex-shrink-0 z-10 flex items-center px-4" style={{ height: TOP_BAR_HEIGHT, backgroundColor: generatePhase === 'notes' ? '#FFFFFF' : 'transparent' }}>
        {isDesktop ? (
          <>
            <div className="flex items-center" style={{ width: DESKTOP_PANEL_WIDTH - 16 - 12 }}>
              {topProfileButton}
              <div className="flex-1 flex justify-center">{topUndoRedo}</div>
              {topCounter}
            </div>
            <div className="flex-1" />
            {topPostArea}
          </>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
            <div className="flex items-center min-w-0">
              {topProfileButton}
              <div className="flex-1 flex justify-center">{topUndoRedo}</div>
            </div>
            {topCounter}
            <div className="flex justify-end">{topPostArea}</div>
          </div>
        )}
      </div>

      {/* Body: notes view (generate mode) or canvas + island (write mode) */}
      {generatePhase === 'notes' ? (
        <NotesView
          value={rawNotes}
          onChange={setRawNotes}
          attachments={attachments}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
        />
      ) : (
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
      {/* Card canvas area */}
      {/* Tapping the empty area around the card deselects, like tapping the
          card's own background (CanvasArea). The panel doesn't, since it
          edits the selection. */}
      <div
        className="flex items-center justify-center flex-shrink-0 order-1 md:order-2 md:flex-1"
        style={{ flex: 1, minHeight: 0 }}
        onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}
      >
        {!showPostFlow &&
        <div className="relative" style={{ width: cardSize, height: cardSize, transform: desktopCardShift }}>
          <CanvasArea
            card={currentCard}
            cardSize={cardSize}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => {
              setSelectedElementId(id);
              if (id) {
                const el = currentCard.elements.find((e) => e.id === id);
                if (el?.type === 'text') setActiveTool('text');
                if (el?.type === 'image' || el?.type === 'video' || el?.type === 'audio') setActiveTool('media');
              }
            }}
            onUpdateElement={updateElement}
            onUpdateCard={updateCurrentCard}
            onRetryImageGeneration={handleRetryImageGeneration}
            autoEditId={autoEditId}
            onAutoEditConsumed={() => setAutoEditId(null)}
            tokens={colorTokens} />
          {loadingDraft && <DraftLoadingOverlay />}
          
          {/* Quick add card — just outside the right edge, vertically centered */}
          <button
            onClick={addCard}
            title="Add card"
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-[6px] border border-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 flex items-center justify-center transition-colors active:scale-95 mr-2"
            style={{ right: -ADD_CARD_REACH }}>
            
            <Plus size={16} />
          </button>
        </div>
        }
      </div>

      {/* Bottom Island — mobile: bottom; desktop: left column */}
      <div className="order-2 md:order-1 md:w-[360px] md:h-full flex-shrink-0 flex flex-col">
      <BottomIsland
        islandHeight={islandHeight}
        onDragIsland={handleIslandDrag}
        cards={cards}
        currentCardIndex={currentCardIndex}
        onNavigate={setCurrentCardIndex}
        onDeleteCard={deleteCard}
        onDuplicateCard={duplicateCard}
        onAddCard={addCard}
        onReorderCards={reorderCards}
        activeTool={activeTool}
        onToolChange={handleToolChange}
        currentCard={currentCard}
        onUpdateCard={updateCurrentCard}
        selectedElement={selectedElement}
        onUpdateElement={(updates) => selectedElementId && updateElement(selectedElementId, updates)}
        onUpdateElementById={updateElement}
        onAddElement={addElement}
        onSelectElement={selectElement}
        onDeleteElement={deleteElement}
        onRemoveMediaByUrl={removeMediaByUrl}
        onDuplicateElement={duplicateElement}
        onDuplicateElementToCard={duplicateElementToCard}
        onReorderElements={reorderTextElements}
        onApplyTemplate={handleApplyTemplate}
        initialCardsTab={editStory || cardsTabVisitedRef.current ? 'Gallery' : 'Templates'}
        cardResetToken={cardResetToken}
        appliedTemplateId={appliedTemplateId}
        colorTokens={colorTokens}
        onApplyTokenColor={handleApplyTokenColor}
        onPreviewColor={handlePreviewColor}
        onSetTokens={handleSetTokens}
        onApplyDraft={handleApplyDraft}
        activeDraftId={draftId}
        appliedDraftId={appliedDraftId}
      />
      </div>
      </div>
      )}

      {showPostFlow &&
      <PostFlowSheet
        cards={cards}
        editingPostId={editingPostId}
        draftId={draftId}
        initialTitle={initialTitle}
        initialTags={initialTags}
        tokens={colorTokens}
        onClose={() => setShowPostFlow(false)}
        onPublishStart={cancelAutosave}
        onPublished={(username) => navigate(`/${username}`)} />

      }

      <GenerateProgress
        visible={generatePhase === 'generating'}
        completedSteps={genProgress.completedSteps}
        totalSteps={genProgress.totalSteps}
        currentStep={genProgress.label}
      />

      {showRegenerateChoice &&
        <RegenerateChoice
          open={showRegenerateChoice}
          onClose={() => setShowRegenerateChoice(false)}
          onEditsOnly={() => handleGenerate('edits_only')}
          onFullRegenerate={() => handleGenerate('full')}
        />
      }

    </div>
    </DraftMediaProvider>);

}