import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Empty stories state for a profile. The owner sees a call-to-action to create
// their first story; a visitor just sees "No stories yet". A tag filter with no
// matches shows a neutral message instead.
export default function ProfileEmptyState({ isOwner, hasTagFilter }) {
  const navigate = useNavigate();

  if (hasTagFilter) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">No stories match the selected tags</p>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Sparkles size={28} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Your wall is empty</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-xs">
          Share your first story and let the world know what you're made of.
        </p>
        <button
          onClick={() => navigate('/create')}
          className="mt-6 bg-black text-white px-5 py-3 rounded-full font-semibold text-sm hover:bg-gray-800 active:scale-95 transition-all"
        >
          Create your first story
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-sm">No stories yet</p>
    </div>
  );
}