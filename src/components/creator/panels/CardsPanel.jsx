import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight } from '@/components/icons';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import CardThumb from '@/components/creator/CardThumb';
import ThumbMenu, { ReorderBar } from '@/components/creator/ThumbMenu';
import DraftEntry from '@/components/creator/DraftEntry';
import { templatesEnabled, SHOW_TEMPLATES_AND_STYLES } from '@/lib/featureFlags';
import { PICKER_TEMPLATES } from '@/lib/storyTemplates';
import TemplateRow from '@/components/creator/TemplateRow';
import LazyMount from '@/components/profile/LazyMount';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Drafts tab shows only the most recently-updated drafts rather than every
// draft ever saved — each row renders its own cover thumbnail plus a full
// strip of per-card thumbnails, so an unbounded list gets expensive to load
// and mount as a user accumulates drafts over time. Recency is exactly what
// this panel is for (resuming recent work), so capping here costs nothing
// functionally.
const RECENT_DRAFTS_LIMIT = 10;

// Template rows are lazy-mounted the same way the public profile feed is:
// today there are only a couple of templates so this is a no-op in
// practice, but each row (cover + full per-card miniature strip, its own
// resize observer) isn't free, and the template library is expected to grow
// — mounting only what's near the viewport keeps that growth cheap.
const TEMPLATE_ROW_PLACEHOLDER = (
  <div className="h-[72px] rounded-xl bg-white/5 animate-pulse" />
);

const TABS = [
  'Gallery',
  ...(templatesEnabled ? ['Templates'] : []),
  ...(SHOW_TEMPLATES_AND_STYLES ? ['Styles'] : []),
  'Drafts',
];

// Placeholder style tiles
const STYLE_PLACEHOLDERS = [
  '#1a1a1a', '#f5f5f5', '#1a1a2e', '#2d6a4f',
  '#3d0c02', '#0f3460', '#2c3e50', '#7b2d8b',
];

export default function CardsPanel({ cards, currentCardIndex, onNavigate, onReorder, onAddCard, onDeleteCard, onDuplicateCard, onApplyDraft, activeDraftId, onApplyTemplate, tokens, initialTab, galleryResetToken, appliedTemplateId, appliedDraftId }) {
  const [tab, setTab] = useState(initialTab || 'Gallery');

  const handleTabChange = (newTab) => {
    setTab(newTab);
  };

  // A new card was just created — open on Gallery instead of whatever tab
  // (Templates/Styles/Drafts) was last used, overriding the normal rule
  // that a panel's tab persists across cards.
  useEffect(() => {
    if (galleryResetToken == null) return;
    setTab('Gallery');
  }, [galleryResetToken]);
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const user = await base44.auth.me();
      const results = await base44.entities.Post.filter({ author_id: user.id, status: 'draft' }, '-updated_date', RECENT_DRAFTS_LIMIT);
      setDrafts(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (tab === 'Drafts') loadDrafts();
  }, [tab]);

  const deleteDraft = async (id) => {
    if (confirmDeleteDraftId === id) {
      setConfirmDeleteDraftId(null);
      try {
        await base44.entities.Post.delete(id);
      } catch (e) {
        // Entity may already be deleted (double-click race, stale list) — remove from local list regardless
      }
      setDrafts(d => d.filter(x => x.id !== id));
    } else {
      setConfirmDeleteDraftId(id);
      setTimeout(() => setConfirmDeleteDraftId(null), 2500);
    }
  };

  const handleDelete = (i) => {
    if (cards.length === 1) return; // can't delete last card
    onDeleteCard(i);
  };

  // Arrow-based swap: move card at `index` one step in `dir` (-1 or +1).
  const swap = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= cards.length) return;
    const reordered = [...cards];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onReorder(reordered);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab row */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-white/40 hover:text-white/60'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* GALLERY tab */}
      {tab === 'Gallery' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
          {reorderMode && <ReorderBar onDone={() => setReorderMode(false)} label="Tap arrows to reorder" />}
          <div className="flex flex-wrap gap-1">
            {/* Add button — always first */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <button
                onClick={onAddCard}
                className="w-16 aspect-square rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
              >
                <Plus size={20} className="text-white/40" />
              </button>
              <span className="text-[9px] text-white/20">Add</span>
            </div>

            {/* Card thumbnails */}
            {cards.map((card, i) => (
              <motion.div key={card.id} layout className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div
                  onClick={reorderMode ? undefined : () => onNavigate(i)}
                  className={`w-16 aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative ${
                    i === currentCardIndex ? 'border-emerald-400' : 'border-white/20 hover:border-white/50'
                  }`}
                >
                  <CardThumb card={card} displaySize={64} tokens={tokens} />
                  <span className="absolute bottom-0.5 right-1 text-[9px] text-white/60 drop-shadow">{i + 1}</span>

                  {/* Reorder arrow controls */}
                  {reorderMode && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); swap(i, -1); }}
                        disabled={i === 0}
                        title="Move left"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-r-lg bg-black/60 flex items-center justify-center disabled:opacity-20 hover:bg-black/80 transition-colors"
                      >
                        <ChevronLeft size={14} className="text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); swap(i, 1); }}
                        disabled={i === cards.length - 1}
                        title="Move right"
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-l-lg bg-black/60 flex items-center justify-center disabled:opacity-20 hover:bg-black/80 transition-colors"
                      >
                        <ChevronRight size={14} className="text-white" />
                      </button>
                    </>
                  )}
                </div>
                {!reorderMode && (
                  <ThumbMenu
                    onDuplicate={() => onDuplicateCard(i)}
                    onReorder={() => setReorderMode(true)}
                    onDelete={() => handleDelete(i)}
                    deleteDisabled={cards.length === 1}
                    deleteTitle="Delete card"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* TEMPLATES tab — browsable rows; Apply is the only destructive action */}
      {tab === 'Templates' && (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <div className="flex flex-col gap-2">
            {PICKER_TEMPLATES.map(template => (
              <LazyMount key={template.id} placeholder={TEMPLATE_ROW_PLACEHOLDER}>
                {() => (
                  <TemplateRow
                    template={template}
                    onApply={onApplyTemplate}
                    appliedTemplateId={appliedTemplateId}
                    currentCardIndex={currentCardIndex}
                  />
                )}
              </LazyMount>
            ))}
          </div>
        </div>
      )}

      {/* STYLES tab */}
      {tab === 'Styles' && (
        <div className="flex-1 overflow-hidden px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {STYLE_PLACEHOLDERS.map((color, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden" style={{ backgroundColor: color }}>
                <div className="absolute inset-0 flex items-end justify-center pb-1.5 bg-black/30">
                  <span className="text-white/60 text-[9px] font-medium">Soon</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRAFTS tab */}
      {tab === 'Drafts' && (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loadingDrafts ? (
            <div className="flex justify-center py-8">
              <PixelSpinner size={20} tone="light" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-white/30 text-xs leading-relaxed">No drafts yet. Stories you save as drafts will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {drafts.map(draft => (
                <DraftEntry
                  key={draft.id}
                  draft={draft}
                  isApplied={appliedDraftId === draft.id}
                  onApply={onApplyDraft}
                  onDelete={() => deleteDraft(draft.id)}
                  confirmDelete={confirmDeleteDraftId === draft.id}
                  currentCardIndex={currentCardIndex}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}