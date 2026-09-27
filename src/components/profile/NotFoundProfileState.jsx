import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, ArrowRight } from 'lucide-react';

// Not-found / unclaimed profile state.
// Shows "This wall isn't claimed yet" with a button that starts the claim
// flow pre-filled with the username the visitor tried to view.
// The Claim button is hidden for authenticated users (they already have a
// username and can't claim a different one via this flow).
export default function NotFoundProfileState({ username }) {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsAuthed).catch(() => setIsAuthed(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] px-6 py-20 text-center">
      <div className="w-full max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5 mx-auto">
          <Sparkles size={28} className="text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">This wall isn't claimed yet</h1>
        <p className="text-gray-500 text-sm mt-2 mb-8">
          {username ? `storywall.io/${username} is available.` : 'This profile doesn\'t exist.'}{isAuthed ? '' : ' Claim it and make it yours.'}
        </p>
        {username && !isAuthed && (
          <button
            onClick={() => navigate(`/signup?username=${encodeURIComponent(username)}`)}
            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-800 active:scale-95 transition-all"
          >
            Claim storywall.io/{username}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}