import { useRef } from 'react';
import CardCarousel from '@/components/creator/CardCarousel';
import Tag from '@/components/profile/Tag';

export default function StoryCard({ post, selectedTags = [], onToggleTag, kebab, onTap }) {
  const hasTitle = !!post.title;
  const titlePointer = useRef(null);

  // Intent detection — only a true tap (minimal movement, short duration)
  // scrolls the story into view; a drag/scroll does not.
  const onTitlePointerDown = (e) => {
    titlePointer.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onTitlePointerUp = (e) => {
    const st = titlePointer.current;
    titlePointer.current = null;
    if (!st || !onTap) return;
    const dx = Math.abs(e.clientX - st.x);
    const dy = Math.abs(e.clientY - st.y);
    const elapsed = Date.now() - st.t;
    if (dx < 8 && dy < 8 && elapsed < 300) onTap();
  };

  return (
    <div>
      {/* Title row — title only, above the card carousel */}
      {hasTitle && (
        <div className="mb-2">
          <h3
            onPointerDown={onTitlePointerDown}
            onPointerUp={onTitlePointerUp}
            className="font-bold text-gray-900 text-base leading-snug cursor-pointer"
          >
            {post.title}
          </h3>
        </div>
      )}

      {/* Horizontal card carousel with kebab overlay */}
      <div className="relative">
        <CardCarousel cards={post.cards} onTap={onTap} tokens={post.color_tokens} />
        {kebab && (
          <div className="absolute bottom-3 right-3 z-20">
            {kebab}
          </div>
        )}
      </div>

      {/* Tags below carousel */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2.5">
          {post.tags.map(tag => (
            <Tag key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => onToggleTag?.(tag)} />
          ))}
        </div>
      )}
    </div>
  );
}