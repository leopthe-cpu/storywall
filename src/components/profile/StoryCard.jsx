import { useRef, useEffect } from 'react';
import CardCarousel from '@/components/creator/CardCarousel';
import Tag from '@/components/profile/Tag';
import { CardFormatProvider } from '@/components/creator/CardFormatContext';
import { Pin, Eye } from '@/components/icons';
import { recordView, VIEW_VISIBLE_RATIO, VIEW_VISIBLE_MS } from '@/lib/viewTracking';

// trackViews: count this story's views (not for the owner's own wall, nor
// template placeholders). uniqueViews: the owner's Lifetime view count,
// shown only when given.
export default function StoryCard({ post, selectedTags = [], onToggleTag, kebab, onTap, trackViews = false, uniqueViews }) {
  const hasTitle = !!post.title;
  const titlePointer = useRef(null);

  // A view counts once the story has been at least half on screen for a
  // second (decision 51); from then on, each card shown counts too.
  const rootRef = useRef(null);
  const seenRef = useRef(false);
  const activeCardRef = useRef(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!trackViews || !el || typeof IntersectionObserver === 'undefined') return;
    let timer = null;
    const io = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (!entry.isIntersecting || seenRef.current) return;
      timer = setTimeout(() => {
        seenRef.current = true;
        recordView(post.id);
        recordView(post.id, activeCardRef.current);
        io.disconnect();
      }, VIEW_VISIBLE_MS);
    }, { threshold: VIEW_VISIBLE_RATIO });
    io.observe(el);
    return () => { clearTimeout(timer); io.disconnect(); };
  }, [trackViews, post.id]);
  const onActiveCardChange = (i) => {
    activeCardRef.current = i;
    if (trackViews && seenRef.current) recordView(post.id, i);
  };

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
    <div ref={rootRef}>
      {/* Title row — title only, above the card carousel */}
      {hasTitle && (
        <div className="mb-2">
          <h3
            onPointerDown={onTitlePointerDown}
            onPointerUp={onTitlePointerUp}
            className="font-bold text-wall-title text-base leading-snug cursor-pointer"
          >
            {post.title}
          </h3>
        </div>
      )}

      {/* Horizontal card carousel with kebab overlay */}
      <div className="relative">
        {/* Each story has its own card size (posts.card_size). */}
        <CardFormatProvider value={post.card_size}>
          <CardCarousel cards={post.cards} onTap={onTap} tokens={post.color_tokens} onActiveCardChange={onActiveCardChange} />
        </CardFormatProvider>
        {/* Pinned to the top of the wall (decision 51), shown to everyone. */}
        {post.pinned_at && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium text-white bg-black/30 backdrop-blur-sm pointer-events-none">
            <Pin size={12} /> Pinned
          </div>
        )}
        {kebab && (
          <div className="absolute bottom-3 right-3 z-20">
            {kebab}
          </div>
        )}
      </div>

      {/* The owner's view count (Lifetime: unique views, decision 50). */}
      {uniqueViews != null && (
        <div className="flex items-center gap-1 pt-2 text-xs text-wall-text-3">
          <Eye size={13} />
          {uniqueViews === 1 ? '1 view' : `${uniqueViews.toLocaleString()} views`}
        </div>
      )}

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