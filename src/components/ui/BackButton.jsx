// Back button for full-screen steps (skills loading, publish): a left arrow
// matching the builder's "Post →", on a dark rounded square like the
// builder's top-bar buttons (6px corners, brand ink #262624).
export default function BackButton({ onClick, className = '', label = 'Back' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 rounded-[6px] bg-[#262624] text-[#F4F2EC] text-sm font-semibold flex items-center justify-center hover:bg-[#30302E] active:scale-95 transition-all ${className}`}
    >
      ←
    </button>
  );
}
