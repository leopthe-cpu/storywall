import { useRef, useCallback } from 'react';
import { Palette, Type, ImageIcon } from 'lucide-react';
import ColorPanel from './panels/ColorPanel';
import TextPanel from './panels/TextPanel';
import MediaPanel from './panels/MediaPanel';
import CardsPanel from './panels/CardsPanel';

function StackedCardsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="11" height="11" rx="2" opacity="0.5" />
      <rect x="2" y="2" width="11" height="11" rx="2" />
    </svg>
  );
}

const TOOLS = [
  { id: 'cards', Icon: StackedCardsIcon, label: 'Cards' },
  { id: 'text', Icon: Type, label: 'Text' },
  { id: 'media', Icon: ImageIcon, label: 'Media' },
  { id: 'color', Icon: Palette, label: 'Theme' },
];

// Island chrome = handle(20) + tool row(56) + border(1) — no nav row anymore
export const ISLAND_CHROME = 77;

export default function BottomIsland({
  islandHeight, onDragIsland,
  cards, currentCardIndex, onNavigate, onDeleteCard, onAddCard, onReorderCards, onDuplicateCard,
  activeTool, onToolChange, currentCard, onUpdateCard,
  selectedElement, onUpdateElement, onUpdateElementById, onAddElement, onApplyDraft, activeDraftId,
  onSelectElement, onDeleteElement, onRemoveMediaByUrl, onDuplicateElement, onReorderElements,
  onApplyTemplate,
  colorTokens, onApplyTokenColor, onPreviewColor, onSetTokens,
  initialCardsTab, cardResetToken, appliedTemplateId, appliedDraftId,
}) {
  const heightRef = useRef(islandHeight);
  heightRef.current = islandHeight;

  const onDragStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.touches?.[0]?.clientY ?? e.clientY;
    const startH = heightRef.current;

    const onMove = (ev) => {
      ev.preventDefault();
      const clientY = ev.touches?.[0]?.clientY ?? ev.clientY;
      onDragIsland(startH + (startY - clientY));
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
  }, [onDragIsland]);

  const panelScrollable = activeTool === 'media' || activeTool === 'cards' || activeTool === 'color';

  return (
    <div
      className="flex-shrink-0 bg-[#1A1A1A] rounded-t-3xl flex flex-col md:!h-full md:rounded-none"
      style={{ height: islandHeight }}
    >
      {/* Drag Handle — 20px */}
      <div
        className="flex justify-center pt-2 pb-0.5 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 md:hidden"
        onPointerDown={onDragStart}
        style={{ height: 20 }}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mt-1" />
      </div>

      {/* Tool Selector — 56px */}
      <div className="flex items-center justify-around px-3 border-b border-white/10 flex-shrink-0" style={{ height: 56 }}>
        {TOOLS.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => onToolChange(id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
              activeTool === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {id === 'cards' ? <Icon /> : <Icon size={20} />}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className={`flex-1 min-h-0 flex flex-col ${panelScrollable ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'} md:overflow-y-auto md:overscroll-contain`}>
        {activeTool === 'color' && (
          <ColorPanel
            card={currentCard}
            tokens={colorTokens}
            cardIndex={currentCardIndex}
            onApplyTokenColor={onApplyTokenColor}
            onPreviewColor={onPreviewColor}
          />
        )}
        {activeTool === 'text' && (
          <TextPanel
            selectedElement={selectedElement?.type === 'text' ? selectedElement : null}
            onUpdateElement={onUpdateElement}
            onUpdateCard={onUpdateCard}
            onAddElement={onAddElement}
            currentCard={currentCard}
            onSelectElement={onSelectElement}
            onDeleteElement={onDeleteElement}
            onDuplicateElement={onDuplicateElement}
            onReorderElements={onReorderElements}
            tokens={colorTokens}
            onSetTokens={onSetTokens}
            cards={cards}
            onNavigate={onNavigate}
            galleryResetToken={cardResetToken}
          />
        )}
        {activeTool === 'media' && (
          <MediaPanel
            selectedElement={selectedElement?.type === 'image' ? selectedElement : null}
            onUpdateElement={onUpdateElement}
            onUpdateElementById={onUpdateElementById}
            onAddElement={onAddElement}
            onDeleteElement={onDeleteElement}
            currentCard={currentCard}
            onSelectElement={onSelectElement}
            onDuplicateElement={onDuplicateElement}
            onUpdateCard={onUpdateCard}
            cards={cards}
            onNavigate={onNavigate}
            onRemoveMediaByUrl={onRemoveMediaByUrl}
            galleryResetToken={cardResetToken}
          />
        )}
        {activeTool === 'cards' && (
          <CardsPanel
            cards={cards}
            currentCardIndex={currentCardIndex}
            onNavigate={onNavigate}
            onReorder={onReorderCards}
            onAddCard={onAddCard}
            onDeleteCard={onDeleteCard}
            onDuplicateCard={onDuplicateCard}
            onApplyDraft={onApplyDraft}
            activeDraftId={activeDraftId}
            onApplyTemplate={onApplyTemplate}
            tokens={colorTokens}
            initialTab={initialCardsTab}
            galleryResetToken={cardResetToken}
            appliedTemplateId={appliedTemplateId}
            appliedDraftId={appliedDraftId}
          />
        )}
      </div>
    </div>
  );
}