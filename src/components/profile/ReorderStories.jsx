import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Check, X } from 'lucide-react';

// Full-screen reorder mode for the stories on a profile. Stories become
// vertically draggable; "Done" returns the new order to the parent.
export default function ReorderStories({ posts, onSave, onCancel }) {
  const [items, setItems] = useState(posts);

  useEffect(() => { setItems(posts); }, [posts]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = [...items];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F7F5] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <button onClick={onCancel} className="flex items-center gap-1 text-gray-500 text-sm">
          <X size={18} /> Cancel
        </button>
        <span className="font-semibold text-gray-900 text-sm">Reorder stories</span>
        <button
          onClick={() => onSave(items)}
          className="flex items-center gap-1 text-black text-sm font-semibold"
        >
          <Check size={18} /> Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-[560px] mx-auto flex flex-col gap-2">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="stories">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
                  {items.map((post, i) => (
                    <Draggable key={post.id} draggableId={post.id} index={i}>
                      {(p) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 px-3 py-3"
                        >
                          <span {...p.dragHandleProps} className="text-gray-300 cursor-grab active:cursor-grabbing touch-none">
                            <GripVertical size={20} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">{post.title || 'Untitled'}</p>
                            <p className="text-gray-400 text-xs">{(post.cards || []).length} cards</p>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}