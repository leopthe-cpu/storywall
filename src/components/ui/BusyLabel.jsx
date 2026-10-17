import PixelSpinner from '@/components/ui/PixelSpinner';

// Button content that shows a small spinner next to the "working" text
// ("Saving…") while the action runs, so a tapped button visibly responds.
// The buttons it's used in are dark, hence the light spinner by default.
export default function BusyLabel({ busy, label, tone = 'light', size = 14, children }) {
  if (!busy) return children;
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <PixelSpinner size={size} tone={tone} />
      {label}
    </span>
  );
}
