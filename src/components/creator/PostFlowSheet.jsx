import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, RotateCw, Plus } from '@/components/icons';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import CardCarousel from '@/components/creator/CardCarousel';
import SkillsLoadingScreen from '@/components/creator/SkillsLoadingScreen';

const MAX_REFRESHES = 3;
const MAX_TOTAL_SELECTED = 5;
const ROW_SIZE = 5;
const SKELETON_COUNT = 5;
const EMPTY_HINT = 'Add skills to help people find your story';

function extractText(cards) {
  const parts = [];
  for (const card of cards || []) {
    for (const el of card?.elements || []) {
      if (el.type === 'text' && el.content) {
        parts.push(String(el.content));
      }
    }
  }
  return parts.join(' ').trim();
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Returns string[] on success (may be empty), or null on API/parse failure.
async function fetchSuggestedSkills(text, tagCount, alreadySelectedTags) {
  try {
    const response = await base44.functions.invoke('suggestSkills', {
      text,
      tag_count: tagCount,
      already_selected_tags: alreadySelectedTags
    });
    const tags = Array.isArray(response?.data?.tags) ? response.data.tags : [];
    // Backend returns error: true when the API call itself failed (not when
    // text was genuinely empty). Treat that as null so the frontend shows
    // the error/retry state instead of a silently empty list.
    const hasError = response?.data?.error === true;
    if (hasError) {
      console.log('[PostFlowSheet] suggestSkills backend returned error=true. Full response:', JSON.stringify(response?.data).slice(0, 500));
    } else if (tags.length === 0) {
      console.log('[PostFlowSheet] suggestSkills returned 0 tags (no error flag). Response:', JSON.stringify(response?.data).slice(0, 500));
    }
    if (hasError && tags.length === 0) return null;
    return tags;
  } catch (e) {
    console.log('[PostFlowSheet] suggestSkills invoke threw:', e?.name || 'Error', '-', e?.message || e, e?.stack?.split('\n')[0] || '');
    return null;
  }
}

export default function PostFlowSheet({ cards, editingPostId, draftId, initialTitle, initialTags, onClose, onPublished, onPublishStart, tokens }) {
  const [title, setTitle] = useState(initialTitle || '');
  const [allSuggestedTags, setAllSuggestedTags] = useState([]);
  const [suggestedSelected, setSuggestedSelected] = useState(() => new Set());
  const [customTags, setCustomTags] = useState(() => initialTags && initialTags.length ? initialTags.slice() : []);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('loading');
  const [hasAttempted, setHasAttempted] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [suggestionError, setSuggestionError] = useState(false);
  const [manualTagDraft, setManualTagDraft] = useState('');
  const titleRef = useRef(null);
  const skillsRef = useRef(null);

  const extractedText = useMemo(() => extractText(cards), [cards]);
  const extractedTextRef = useRef(extractedText);
  extractedTextRef.current = extractedText;
  const hasText = extractedText.length > 0;
  const calledOnce = useRef(false);
  const recordId = editingPostId || draftId;
  const customTagsRef = useRef(customTags);
  customTagsRef.current = customTags;

  // Load refresh counter from the story record on mount — persists across
  // close/reopen, resets when the calendar day changes.
  useEffect(() => {
    if (!recordId) return;
    base44.entities.Post.get(recordId).then((post) => {
      if (!post) return;
      const today = getTodayStr();
      if (post.skill_refresh_date === today) {
        setRefreshCount(post.skill_refresh_count || 0);
      }
    }).catch(() => {});
  }, [recordId]);

  // Fire the initial suggestion call once on mount (triggered by the Post → click).
  // Skip when editing an existing story that already has saved skills — those
  // load from initialTags (as customTags) and should stay untouched. The user
  // can still tap regenerate to get fresh suggestions if they want them.
  // Auto-retries once on failure before showing the publish screen without tags.
  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;
    if (editingPostId && initialTags && initialTags.length > 0) {
      setHasAttempted(true);
      setPhase('ready');
      return;
    }
    if (!hasText) {
      setHasAttempted(true);
      setPhase('ready');
      return;
    }

    setSuggestionError(false);
    const generateWithRetry = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const tags = await fetchSuggestedSkills(extractedTextRef.current, ROW_SIZE, []);
        if (tags !== null) {
          if (tags.length > 0) {
            setAllSuggestedTags(tags);
          }
          // No auto-selection — chips start unselected; user taps to select.
          setSuggestedSelected(new Set());
          setHasAttempted(true);
          setPhase('ready');
          return;
        }
        console.log(`[PostFlowSheet] skill generation attempt ${attempt + 1} failed${attempt === 0 ? ', retrying...' : ''}`);
      }
      // Both attempts failed — show publish screen without tags
      setSuggestionError(true);
      setHasAttempted(true);
      setPhase('ready');
    };
    generateWithRetry();
  }, [hasText, extractedText]);

  const totalSelected = suggestedSelected.size + customTags.length;
  const canSelectMore = totalSelected < MAX_TOTAL_SELECTED;

  // Row: show the first ROW_SIZE tags in their current order. Selection does
  // NOT reorder the list — chips stay where they are when toggled. Reordering
  // (selected first, then new ones) only happens at refresh/regenerate time
  // inside handleRefresh, not as a side effect of selection.
  const rowTags = useMemo(() => {
    return allSuggestedTags.slice(0, ROW_SIZE);
  }, [allSuggestedTags]);

  const addManualTag = () => {
    const val = manualTagDraft.trim();
    if (!val || totalSelected >= MAX_TOTAL_SELECTED) return;
    const existingLower = new Set([...suggestedSelected, ...customTags].map((t) => t.toLowerCase()));
    if (existingLower.has(val.toLowerCase())) { setManualTagDraft(''); return; }
    setCustomTags((t) => [...t, val]);
    setManualTagDraft('');
  };

  const toggleSuggested = (tag) => {
    setSuggestedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        if (totalSelected >= MAX_TOTAL_SELECTED) return prev;
        next.add(tag);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    if (loading || refreshCount >= MAX_REFRESHES) return;
    if (!extractedTextRef.current) return;

    // Fill-the-gap: generate only enough new skills to reach the target of 5.
    // Keeps all currently selected skills as-is; new ones come in unselected.
    const currentTotal = suggestedSelected.size + customTags.length;
    if (currentTotal >= MAX_TOTAL_SELECTED) return; // Already at target

    const newCount = MAX_TOTAL_SELECTED - currentTotal;
    const allSelected = [...suggestedSelected, ...customTags];

    const newRefreshCount = refreshCount + 1;
    const today = getTodayStr();
    setRefreshCount(newRefreshCount);
    setLoading(true);
    setSuggestionError(false);

    const tags = await fetchSuggestedSkills(extractedTextRef.current, newCount, allSelected);

    if (tags === null) {
      setSuggestionError(true);
    } else if (tags.length > 0) {
      // Add new tags and reorder: selected first (in their current order), then
      // newly generated ones, then old unselected ones. This is the ONLY time
      // the list reorders — normal selection/deselection never reorders.
      setAllSuggestedTags((prev) => {
        const existing = new Set(prev);
        const fresh = tags.filter((t) => !existing.has(t));
        const selectedInPrev = prev.filter((t) => suggestedSelected.has(t));
        const unselectedInPrev = prev.filter((t) => !suggestedSelected.has(t));
        return [...selectedInPrev, ...fresh, ...unselectedInPrev];
      });
    }

    setHasAttempted(true);
    setLoading(false);

    // Persist refresh counter to the story record
    if (recordId) {
      try {
        await base44.entities.Post.update(recordId, {
          skill_refresh_count: newRefreshCount,
          skill_refresh_date: today
        });
      } catch (e) {
        console.log('[PostFlowSheet] failed to save refresh count:', e?.message || e);
      }
    }
  };

  const firstCard = cards[0];
  const coverImage = firstCard?.elements?.find((e) => e.type === 'image')?.image_url;

  // Final tags for publish: dedup suggested + custom, capped at 5
  const selectedTags = useMemo(
    () => [...new Set([...suggestedSelected, ...customTags])].slice(0, MAX_TOTAL_SELECTED),
    [suggestedSelected, customTags]
  );

  const missingSkill = selectedTags.length === 0;

  const handlePublish = async () => {
    // A card can still be showing a photo's optimistic local preview (a
    // blob: URL from MediaPanel, shown immediately while the real upload
    // finishes in the background) — that URL is only valid in this browser
    // tab, so publishing it now would permanently save an unusable image
    // reference. Block until every upload has resolved to a real URL.
    const hasPendingBlobMedia = cards.some((c) =>
      (c?.elements || []).some((el) => typeof el?.image_url === 'string' && el.image_url.startsWith('blob:'))
    );
    if (hasPendingBlobMedia) {
      setError('Still uploading a photo — give it a moment and try again.');
      return;
    }
    await onPublishStart?.();
    setPublishing(true);
    try {
      const user = await base44.auth.me();
      const cardsPayload = cards.map((c, i) => ({
        id: c.id,
        order: i,
        background_color: c.background_color || '#FFFFFF',
        background_token: c.background_token,
        backgroundImageId: c.backgroundImageId,
        elements: (c.elements || []).map((el) => ({ ...el }))
      }));
      const pubRes = await base44.functions.invoke('publishStoryMedia', {
        cards: cardsPayload,
        postId: editingPostId || null
      });
      const publishedCards = pubRes?.data?.cards || cardsPayload;
      const firstPublished = publishedCards[0];
      const publishedCover = firstPublished?.elements?.find((e) => e.type === 'image')?.image_url || '';
      if (editingPostId) {
        await base44.entities.Post.update(editingPostId, {
          title: title.trim(),
          tags: selectedTags,
          cards: publishedCards,
          color_tokens: tokens,
          status: 'published',
          cover_image: publishedCover
        });
      } else {
        await base44.entities.Post.create({
          author_id: user.id,
          author_username: user.username || '',
          title: title.trim(),
          tags: selectedTags,
          cards: publishedCards,
          color_tokens: tokens,
          status: 'published',
          cover_image: publishedCover
        });
      }
      if (draftId && draftId !== editingPostId) {
        try {await base44.entities.Post.delete(draftId);} catch (e) {console.error('Failed to delete draft:', e);}
      }
      onPublished(user.username || user.id);
    } catch (e) {
      setError(e.message);
      setPublishing(false);
    }
  };

  const handleButtonClick = () => {
    if (publishing) return;
    if (missingSkill) {
      setError('Please select a skill');
      skillsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    handlePublish();
  };

  const refreshDisabled = loading || refreshCount >= MAX_REFRESHES || totalSelected >= MAX_TOTAL_SELECTED;
  // Only show the error state when there are no tags at all (initial call failed).
  // If a refresh fails but previous tags exist, keep showing them silently.
  const showError = hasAttempted && !loading && hasText && suggestionError && allSuggestedTags.length === 0;

  if (phase === 'loading') {
    return <SkillsLoadingScreen onClose={onClose} />;
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#F7F7F5]">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-semibold text-gray-900 text-base">{editingPostId ? 'Update story' : 'Publish story'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-8">
        {/* 1. Story Title */}
        <div ref={titleRef}>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block my-4">STORY TITLE</label>
          <input
            value={title}
            onChange={(e) => {setTitle(e.target.value.slice(0, 60));setError('');}}
            placeholder="Give your story a title..."
            maxLength={60}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20" />

          <div className="flex justify-between">
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <span className="text-xs text-gray-400 ml-auto">{title.length}/60</span>
          </div>
        </div>

        {/* 2. Card preview carousel — unconstrained (CardCarousel fills its
            parent's width), so on desktop it's capped to the same width as
            the story card shows at in the profile feed (340px, matching the
            profile picture) instead of stretching edge-to-edge. Mobile is
            left full-width, matching the feed's own mobile behavior. */}
        {cards.length > 0 &&
        <div className="md:max-w-[340px] md:mx-auto">
          <CardCarousel cards={cards} tokens={tokens} />
        </div>
        }

        {/* 3. Skills section */}
        <div ref={skillsRef}>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Skills</label>
            {hasText && !showError &&
            <button
              onClick={handleRefresh}
              disabled={refreshDisabled}
              className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30"
              title={refreshCount >= MAX_REFRESHES ? 'Daily refresh limit reached' : 'Regenerate suggestions'}>
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            }
          </div>

          {/* Suggested chips area */}
          {hasText ?
          loading ?
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) =>
            <div key={i} className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
            )}
          </div> :
          showError ?
          <div className="mb-3 flex flex-col gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshDisabled}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.99] transition-all disabled:opacity-40">
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Retrying…' : 'Try matching again'}
            </button>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Or tag your own skills</p>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-black/20">
                <input
                  value={manualTagDraft}
                  onChange={(e) => setManualTagDraft(e.target.value.slice(0, 40))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualTag(); } }}
                  placeholder="Type a skill…"
                  className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent min-w-0" />
                <button
                  onClick={addManualTag}
                  disabled={!manualTagDraft.trim() || totalSelected >= MAX_TOTAL_SELECTED}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-black text-white disabled:opacity-30 hover:bg-gray-900 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div> :
          rowTags.length > 0 ?
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {rowTags.map((tag) => {
              const selected = suggestedSelected.has(tag);
              const canToggle = selected || canSelectMore;
              return (
                <button
                  key={tag}
                  onClick={() => canToggle && toggleSuggested(tag)}
                  disabled={!canToggle}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-500 border-gray-300'
                  } ${canToggle ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                >
                  {tag}
                </button>);

            })}
          </div> :
          <p className="text-xs text-gray-400 mb-3">{EMPTY_HINT}</p> :
          <p className="text-xs text-gray-400 mb-3">Empty story — write something first.</p>
          }

          {/* Custom tags */}
          {customTags.length > 0 &&
          <div className="flex flex-wrap gap-2 mb-2">
            {customTags.map((tag) =>
            <span key={tag} className="flex items-center gap-1.5 text-xs bg-black text-white px-3 py-1.5 rounded-full">
                {tag}
                <button onClick={() => setCustomTags((t) => t.filter((x) => x !== tag))} className="text-white/70 hover:text-white">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
          }

        </div>
      </div>

      {/* 4. Publish button */}
      <div className="px-5 pb-8 pt-4 border-t border-gray-100">
        <button
          onClick={handleButtonClick}
          disabled={publishing}
          className={`w-full bg-black text-white py-4 rounded-2xl font-semibold text-base transition-all ${
            (publishing || missingSkill) ? 'opacity-50' : 'hover:bg-gray-900 active:scale-[0.98]'
          }`}>
          {publishing
            ? (editingPostId ? 'Updating...' : 'Publishing...')
            : missingSkill
              ? 'Select a Skill'
              : (editingPostId ? 'Update' : 'Publish')}
        </button>
      </div>
    </motion.div>);
}