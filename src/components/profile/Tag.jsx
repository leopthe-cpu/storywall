export default function Tag({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
        selected
          ? 'bg-black text-white border-black'
          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
      }`}
      style={selected ? {} : { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
    >
      {label}
    </button>
  );
}