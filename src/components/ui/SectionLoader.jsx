import { useEffect, useState } from 'react';
import PixelSpinner from '@/components/ui/PixelSpinner';
import { RefreshCw } from '@/components/icons';

// Loading / failed state for a list inside a page or panel (Drafts,
// Archives). Same rule as PageLoader: nothing for the first 0.4 s so quick
// loads don't flash a spinner, then the spinner. A failed load says so with
// "Try again", instead of looking like an empty list.
//
// tone="light" for dark panels (the builder), "dark" for light ones.

const SHOW_SPINNER_AFTER_MS = 400;

export default function SectionLoader({ error = false, onRetry, tone = 'dark', className = 'py-8' }) {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (error) return undefined;
    setShowSpinner(false);
    const t = setTimeout(() => setShowSpinner(true), SHOW_SPINNER_AFTER_MS);
    return () => clearTimeout(t);
  }, [error]);

  const light = tone === 'light';
  if (error) {
    return (
      <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
        <p className={`text-xs ${light ? 'text-white/50' : 'text-gray-500'}`}>Couldn&apos;t load this. Check your connection.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold active:scale-95 transition-all ${
              light ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`flex justify-center ${className}`} aria-busy="true">
      {showSpinner && <PixelSpinner size={20} tone={tone} />}
    </div>
  );
}
