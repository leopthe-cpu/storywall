import { useEffect, useState } from 'react';
import PixelSpinner from '@/components/ui/PixelSpinner';
import GridBackdrop from '@/components/ui/GridBackdrop';
import LoadingTimeout from '@/components/LoadingTimeout';

// Full-page loading state, shared by every page that waits for data before
// it can draw anything (sign-in check, profile, onboarding).
//
// Most of these loads finish in well under a second, and a spinner that
// flashes up for 200 ms reads as a glitch, not as progress. So:
//   - first SHOW_SPINNER_AFTER_MS: just the page background;
//   - then the pixel spinner;
//   - after TIMEOUT_MS: "Taking a while…" with Retry, so a stuck load is
//     never an endless spinner.
// The background is the paper grid (roadmap A2, Oz 2026-10-16: no loading
// screen is just a spinner on blank). grid={false} gives a plain
// `background` instead, for admin tools.

const SHOW_SPINNER_AFTER_MS = 400;
const TIMEOUT_MS = 10000;

export default function PageLoader({ background = '#F4F2EC', grid = true, onRetry }) {
  const [stage, setStage] = useState('blank');

  useEffect(() => {
    const spinner = setTimeout(() => setStage('spinner'), SHOW_SPINNER_AFTER_MS);
    const timeout = setTimeout(() => setStage('timeout'), TIMEOUT_MS);
    return () => { clearTimeout(spinner); clearTimeout(timeout); };
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background }}>
      {grid && <GridBackdrop />}
      {stage === 'timeout' ? (
        <div className="relative">
          <LoadingTimeout onRetry={onRetry} background="transparent" />
        </div>
      ) : (
        <div className="relative h-full flex items-center justify-center">
          {stage === 'spinner' && <PixelSpinner size={24} />}
        </div>
      )}
    </div>
  );
}
