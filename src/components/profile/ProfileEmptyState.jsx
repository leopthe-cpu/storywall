import { PixelSparkles as Sparkles } from '@/components/icons-pixel-empty';
import { useNavigate } from 'react-router-dom';

// Empty stories state for a profile. The owner sees a call-to-action to create
// their first story; a visitor just sees "No stories yet". A tag filter with no
// matches shows a neutral message instead.
export default function ProfileEmptyState({ isOwner, hasTagFilter }) {
  const navigate = useNavigate();

  if (hasTagFilter) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8A877F] text-sm">No stories match the selected tags</p>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#ECE9E1] flex items-center justify-center mb-4">
          <Sparkles size={28} className="text-[#8A877F]" />
        </div>
        <h2 className="font-display text-2xl leading-tight font-medium text-[#262624]">Your wall is empty</h2>
        <p className="text-[#6B6964] text-sm mt-2 max-w-xs">
          Share your first story and let the world know what you're made of.
        </p>
        <button
          onClick={() => navigate('/create')}
          className="mt-6 bg-[#262624] text-[#F4F2EC] px-5 py-3 rounded-full font-semibold text-sm hover:bg-[#30302E] active:scale-95 transition-all"
        >
          Create your first story
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <p className="text-[#8A877F] text-sm">No stories yet</p>
    </div>
  );
}