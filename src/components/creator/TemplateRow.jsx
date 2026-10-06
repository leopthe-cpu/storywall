import { useMemo, useState, useRef, useEffect } from 'react';
import CardThumb from '@/components/creator/CardThumb';
import MiniatureStrip from '@/components/creator/MiniatureStrip';
import { buildTemplateCards } from '@/lib/storyTemplates';
import { ChevronLeft, ChevronRight } from '@/components/icons';

const THUMB_SIZE = 28;
const GAP = 4;
const STEP = THUMB_SIZE + GAP;

// A single template row in the Templates list.
// The cover thumbnail (left) is always the template's first card.
// Tapping the row opens the template into the builder at card 1.
// Tapping a miniature opens the template at that specific card.
// Both actions autosave the current story first.
export default function TemplateRow({ template, onApply, appliedTemplateId, currentCardIndex }) {
  const isApplied = appliedTemplateId === template.id;
  const templateCards = useMemo(() => buildTemplateCards(template, true), [template.id]);
  const coverCard = templateCards[0];

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
  const maxOffset = Math.max(0, templateCards.length - visibleCount);
  const clampedOffset = Math.max(0, Math.min(offset, maxOffset));

  const activeIndex = isApplied && templateCards.length > 0
    ? Math.min(currentCardIndex ?? 0, templateCards.length - 1)
    : null;
  const counterLabel = templateCards.length > 0 ? `${(activeIndex ?? 0) + 1}/${templateCards.length}` : null;

  return (
    <div
      onClick={() => onApply(template)}
      className={`relative flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
        isApplied ? 'bg-emerald-400/10 ring-1 ring-emerald-400' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {/* Cover thumbnail — always the first card, fixed */}
      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
        <CardThumb card={coverCard} displaySize={56} />
      </div>

      {/* Name + miniature strip with position indicator + pagination arrows.
          min-w-0 on rowRef is required so this flex item can actually shrink
          to fit and let MiniatureStrip's internal overflow-hidden clip many
          cards instead of overflowing the row (see DraftEntry.jsx). */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <p className="text-white text-xs font-medium truncate">{template.name}</p>
        <div ref={rowRef} className="relative min-w-0" onClick={(e) => e.stopPropagation()}>
          <MiniatureStrip
            cards={templateCards}
            tokens={[]}
            activeIndex={activeIndex}
            onMiniatureClick={(i) => onApply(template, i)}
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