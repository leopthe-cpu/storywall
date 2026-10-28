// Skill tag pill, in the wall's tag colours (--wall-tag*, src/index.css).
// `interactive={false}` renders the identical look as a plain
// <span> (used by the landing hero) so it isn't a focusable, clickable button.
export default function Tag({ label, selected, onClick, interactive = true }) {
  const className = `text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
    selected
      ? 'bg-wall-tag-selected text-wall-tag-selected-text border-wall-tag-selected'
      : `bg-wall-tag border-wall-tag-border text-wall-tag-text${interactive ? ' hover:border-wall-tag-border-hover' : ''}`
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
