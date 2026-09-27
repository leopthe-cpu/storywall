import { useMemo } from 'react';
import CardThumb from '@/components/creator/CardThumb';
import MiniatureStrip from '@/components/creator/MiniatureStrip';
import { buildTemplateCards } from '@/lib/storyTemplates';

// A single template row in the Templates list.
// The cover thumbnail (left) is always the template's first card.
// Tapping the row opens the template into the builder at card 1.
// Tapping a miniature opens the template at that specific card.
// Both actions autosave the current story first.
export default function TemplateRow({ template, onApply, appliedTemplateId, currentCardIndex }) {
  const isApplied = appliedTemplateId === template.id;
  const templateCards = useMemo(() => buildTemplateCards(template, true), [template.id]);
  const coverCard = templateCards[0];

  const activeIndex = isApplied && templateCards.length > 0
    ? Math.min(currentCardIndex ?? 0, templateCards.length - 1)
    : null;

  return (
    <div
      onClick={() => onApply(template)}
      className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
        isApplied ? 'bg-white/15 ring-1 ring-white/40' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {/* Cover thumbnail — always the first card, fixed */}
      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
        <CardThumb card={coverCard} displaySize={56} />
      </div>

      {/* Name + miniature strip with position indicator */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <p className="text-white text-xs font-medium truncate">{template.name}</p>
        <MiniatureStrip
          cards={templateCards}
          tokens={[]}
          activeIndex={activeIndex}
          onMiniatureClick={(i) => onApply(template, i)}
          thumbSize={28}
          gap={4}
        />
      </div>
    </div>
  );
}