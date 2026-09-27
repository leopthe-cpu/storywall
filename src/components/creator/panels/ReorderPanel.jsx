import { Plus } from 'lucide-react';

export default function ReorderPanel({ cards, currentCardIndex, onNavigate, onReorder, onAddCard }) {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', index);
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'));
    if (dragIndex === dropIndex) return;
    const reordered = [...cards];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    onReorder(reordered);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {cards.map((card, i) => (
          <div
            key={card.id}
            draggable
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, i)}
            onClick={() => onNavigate(i)}
            className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer"
          >
            <div
              className={`w-16 aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                i === currentCardIndex ? 'border-white' : 'border-white/20 hover:border-white/50'
              }`}
              style={{ backgroundColor: card.background_color || '#000' }}
            >
              {card.elements?.find(e => e.type === 'image') && (
                <img
                  src={card.elements.find(e => e.type === 'image').image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
            <span className="text-white/40 text-[10px]">{i + 1}</span>
          </div>
        ))}

        {/* Add card */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={onAddCard}
            className="w-16 aspect-square rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/50 transition-colors"
          >
            <Plus size={18} className="text-white/40" />
          </button>
          <span className="text-white/20 text-[10px]">Add</span>
        </div>
      </div>
    </div>
  );
}