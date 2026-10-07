// Skill tag pill. `interactive={false}` renders the identical look as a plain
// <span> (used by the landing hero) so it isn't a focusable, clickable button.
export default function Tag({ label, selected, onClick, interactive = true }) {
  const className = `text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
    selected
      ? 'bg-black text-white border-black'
      : `bg-white border-gray-200 text-gray-700${interactive ? ' hover:border-gray-400' : ''}`
  }`;
  const style = selected ? {} : { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' };
  if (!interactive) {
    return <span className={`inline-block whitespace-nowrap ${className}`} style={style}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
    >
      {label}
    </button>
  );
}
