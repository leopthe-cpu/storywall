import { useEffect, useState } from 'react';
import PixelSpinner from '@/components/ui/PixelSpinner';
import LoadingTimeout from '@/components/LoadingTimeout';

// Full-page loading state, shared by every page that waits for data before
// it can draw anything (sign-in check, profile, onboarding).
//
// Most of these loads finish in well under a second, and a spinner that
// flashes up for 200 ms reads as a glitch, not as progress. So:
//   - first SHOW_SPINNER_AFTER_MS: just the page background (blank);
//   - then the pixel spinner;
//   - after TIMEOUT_MS: "Taking a while…" with Retry, so a stuck load is
//     never an endless spinner.
// `background` should match the page that's loading, so nothing changes
// colour when it appears.

const SHOW_SPINNER_AFTER_MS = 400;
const TIMEOUT_MS = 10000;

export default function PageLoader({ background = '#F4F2EC', onRetry }) {
  const [stage, setStage] = useState('blank');

  useEffect(() => {
    const spinner = setTimeout(() => setStage('spinner'), SHOW_SPINNER_AFTER_MS);
    const timeout = setTimeout(() => setStage('timeout'), TIMEOUT_MS);
    return () => { clearTimeout(spinner); clearTimeout(timeout); };
  }, []);

  if (stage === 'timeout') return <LoadingTimeout onRetry={onRetry} background={background} />;
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background }}>
      {stage === 'spinner' && <PixelSpinner size={24} />}
    </div>
  );
}
