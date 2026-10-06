import { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from '@/components/icons';
import { formatDistanceToNow } from 'date-fns';
import CardThumb from '@/components/creator/CardThumb';
import MiniatureStrip from '@/components/creator/MiniatureStrip';

const MAIN_SIZE = 72;
const THUMB_SIZE = 28;
const GAP = 4;
const STEP = THUMB_SIZE + GAP;

// A single draft row in the Drafts tab: a large cover preview on the left,
// a paginated row of per-card thumbnails, and a delete button.
// Tapping the row opens the draft into the builder at card 1.
// Tapping a miniature opens the draft at that specific card.
// Both actions autosave the current story first.
export default function DraftEntry({ draft, onApply, onDelete, confirmDelete, isApplied, currentCardIndex }) {
  const cards = draft.cards || [];
  const [offset, setOffset] = useState(0);
  const rowRef = useRef(null);
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (rowRef.current) setRowWidth(rowRef.current.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, []);

  const visibleCount = Math.max(1, Math.floor((rowWidth + GAP) / STEP));
  const maxOffset = Math.max(0, cards.length - visibleCount);
  const clampedOffset = Math.max(0, Math.min(offset, maxOffset));

  const coverCard = cards[0];
  const timeAgo = draft.updated_date ? formatDistanceToNow(new Date(draft.updated_date), { addSuffix: true }) : '';

  const activeIndex = isApplied && cards.length > 0
    ? Math.min(currentCardIndex ?? 0, cards.length - 1)
    : null;
  const counterLabel = cards.length > 0 ? `${(activeIndex ?? 0) + 1}/${cards.length}` : null;

  return (
    <div
      onClick={() => onApply(draft)}
      className={`relative flex items-start gap-3 rounded-xl p-2.5 transition-colors cursor-pointer ${
        isApplied ? 'bg-emerald-400/10 ring-1 ring-emerald-400' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {/* Main preview — always the first card (cover) */}
      <div
        className="rounded-lg overflow-hidden flex-shrink-0"
        style={{ width: MAIN_SIZE, height: MAIN_SIZE }}
      >
        <CardThumb card={coverCard} displaySize={MAIN_SIZE} tokens={draft.color_tokens} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          {/* Miniature strip with position indicator + pagination arrows.
              min-w-0 is required here: without it this flex item won't shrink
              below its content's intrinsic width (the overflow-hidden clip
              inside MiniatureStrip is one level down, so it can't rescue the
              flex sizing on its own), which is what made many-card drafts
              overflow the row instead of clipping/paginating. */}
          <div ref={rowRef} className="flex-1 min-w-0 relative" onClick={(e) => e.stopPropagation()}>
            <MiniatureStrip
              cards={cards}
              tokens={draft.color_tokens}
              activeIndex={activeIndex}
              onMiniatureClick={(i) => onApply(draft, i)}
              thumbSize={THUMB_SIZE}
              gap={GAP}
              offset={clampedOffset}
            />
            {clampedOffset > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setOffset(o => Math.max(0, o - 1)); }}
                className="absolute left-0 top-0 w-5 rounded bg-black/50 hover:bg-black/70 flex items-center justify-center"
                style={{ height: THUMB_SIZE }}
              >
                <ChevronLeft size={12} className="text-white/80" />
              </button>
            )}
            {clampedOffset < maxOffset && (
              <button
                onClick={(e) => { e.stopPropagation(); setOffset(o => Math.min(maxOffset, o + 1)); }}
                className="absolute right-0 top-0 w-5 rounded bg-black/50 hover:bg-black/70 flex items-center justify-center"
                style={{ height: THUMB_SIZE }}
              >
                <ChevronRight size={12} className="text-white/80" />
              </button>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              confirmDelete ? 'bg-red-500/40 text-red-300' : 'bg-white/10 hover:bg-red-500/30 text-white/40'
            }`}
          >
            <Trash2 size={12} />
          </button>
        </div>

        <p className="text-white/30 text-[10px]">Saved {timeAgo}</p>
      </div>

      {/* Card-position counter, bottom-right corner of the row */}
      {counterLabel && (
        <span
          className={`absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums leading-none ${
            isApplied ? 'bg-emerald-400 text-black' : 'bg-black/60 text-white/70'
          }`}
        >
          {counterLabel}
        </span>
      )}
    </div>
  );
}