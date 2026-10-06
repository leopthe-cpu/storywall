import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@/components/icons';
import { PixelSparkles as Sparkles } from '@/components/icons-pixel-empty';

// Not-found / unclaimed profile state.
// Shows "This wall isn't claimed yet" with a button that starts the exact
// same claim flow as the homepage's "Claim your wall" (→ /signup?username=),
// pre-filled with the username the visitor tried to view. Shown regardless
// of whether the visitor happens to be signed into a different account —
// /signup itself already handles that case (it shows its own "you're
// already signed in" screen with a sign-out-and-create-new option).
export default function NotFoundProfileState({ username }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F2EC] px-6 py-20 text-center">
      <div className="w-full max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-[#ECE9E1] flex items-center justify-center mb-5 mx-auto">
          <Sparkles size={28} className="text-[#8A877F]" />
        </div>
        <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">This wall isn't claimed yet</h1>
        <p className="text-[#6B6964] text-sm mt-2 mb-8">
          {username ? `storywall.io/${username} is available. Claim it and make it yours.` : 'This profile doesn\'t exist.'}
        </p>
        {username && (
          <button
            onClick={() => navigate(`/signup?username=${encodeURIComponent(username)}`)}
            className="inline-flex items-center gap-2 bg-[#262624] text-[#F4F2EC] px-6 py-3.5 rounded-full font-semibold text-sm hover:bg-[#30302E] active:scale-95 transition-all"
          >
            Claim storywall.io/{username}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}