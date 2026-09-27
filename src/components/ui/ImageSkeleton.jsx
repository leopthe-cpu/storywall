// Skeleton placeholder for images: a neutral block with a soft light beam
// sweeping across it while the image loads. Fills its (relative) parent, so it
// takes the exact shape of whatever frame it sits in (rounded corners/crop
// come from the parent's overflow-hidden + radius).
//
// Stays mounted and fades out once `loaded` is true (the fade-in reveal from
// the reference pen); snaps back instantly when a new image starts loading so
// there's never a transparent gap.
export default function ImageSkeleton({ loaded, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`image-skeleton ${className}`}
      style={{ opacity: loaded ? 0 : 1, transition: loaded ? 'opacity 0.5s ease' : 'none' }}
    />
  );
}
