import { useMemo, useState, useRef, useEffect } from 'react';
import CardThumb from '@/components/creator/CardThumb';
import MiniatureStrip from '@/components/creator/MiniatureStrip';
import { buildTemplateCards } from '@/lib/storyTemplates';
import { buildFrameworkTemplate, isFrameworkTemplate } from '@/lib/frameworkTemplates';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { CardFormatProvider } from '@/components/creator/CardFormatContext';
import { LEGACY_CARD_SIZE, cardAspectRatio } from '@/lib/cardGeometry';

const THUMB_SIZE = 28;
const GAP = 4;
const STEP = THUMB_SIZE + GAP;

// The cards a template row previews. Framework templates are laid out by the
// generated-story engine, which waits for fonts, so they arrive a moment later.
function useTemplateCards(template, cardSize) {
  const framework = isFrameworkTemplate(template);
  const plain = useMemo(() => (framework ? [] : buildTemplateCards(template, true)), [template.id, framework]);
  const [laidOut, setLaidOut] = useState([]);
  useEffect(() => {
    if (!framework) return undefined;
    let alive = true;
    buildFrameworkTemplate(template, cardSize)
      .then(({ cards }) => { if (alive) setLaidOut(cards); })
      .catch((e) => console.error('[TemplateRow] template layout failed:', e));
    return () => { alive = false; };
  }, [template.id, framework, cardSize]);
  return framework ? laidOut : plain;
}

// A single template row in the Templates list.
// The cover thumbnail (left) is always the template's first card.
// Tapping the row opens the template into the builder at card 1.
// Tapping a miniature opens the template at that specific card.
// Both actions autosave the current story first.
// A template is previewed at the size the story made from it will have
// (`cardSize`, see StoryCreator's templateCardSize). The older plain
// templates (storyTemplates.js) are only laid out on square cards.
export default function TemplateRow({ cardSize, ...props }) {
  const size = isFrameworkTemplate(props.template) ? cardSize : LEGACY_CARD_SIZE;
  return (
    <CardFormatProvider value={size}>
      <TemplateRowBody {...props} cardSize={size} />
    </CardFormatProvider>
  );
}

function TemplateRowBody({ template, onApply, appliedTemplateId, currentCardIndex, cardSize }) {
  const isApplied = appliedTemplateId === template.id;
  const templateCards = useTemplateCards(template, cardSize);
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
      <div className="w-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10" style={{ aspectRatio: cardAspectRatio(cardSize) }}>
        {coverCard ? <CardThumb card={coverCard} displaySize={56} /> : <div className="w-full h-full bg-white/5" />}
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