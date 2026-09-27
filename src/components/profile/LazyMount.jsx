import { useEffect, useRef, useState } from 'react';

// Defers mounting expensive children — e.g. a story's full carousel: every
// card, every image, a resize observer per card — until the wrapper is
// close to entering the viewport, instead of mounting every story on a
// profile at once on first paint. Once revealed it stays mounted: this
// spreads mount cost across scrolling rather than fully virtualizing the
// list, so nothing about an individual story's behavior changes once it's
// shown (its own carousel, autoplay, etc. all work exactly as before).
//
// The host div (and any data attributes passed through, e.g. data-story-id)
// exists immediately, before the real content mounts, so features that
// locate a story by querying the DOM (tag-filter scroll, share-link scroll)
// keep working even for stories that haven't rendered yet. Those two
// features jump straight to a story with scrollIntoView rather than the
// user organically scrolling past it, so they can't always rely on the
// IntersectionObserver noticing in time — dispatching a 'storywall:reveal'
// custom event on the host element (see PublicProfile.jsx) forces this
// story to mount immediately, no observer round-trip required.
export default function LazyMount({ children, placeholder, rootMargin = '800px 0px', ...hostProps }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No IntersectionObserver support — fail open rather than never showing content.
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  // Explicit reveal escape hatch for programmatic scroll-to-story (tag
  // filter, share link) — always attached, independent of the observer.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onReveal = () => setVisible(true);
    el.addEventListener('storywall:reveal', onReveal);
    return () => el.removeEventListener('storywall:reveal', onReveal);
  }, []);

  return (
    <div ref={ref} {...hostProps}>
      {visible
        ? children()
        : (placeholder || (
            <div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ aspectRatio: '1/1' }} />
          ))}
    </div>
  );
}
