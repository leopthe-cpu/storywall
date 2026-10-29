// Marker highlights on parts of a text box (decision 51: the user picks the
// colour). Stored on the text element as `highlights: [{ start, end, color }]`
// — character offsets into `content` (end exclusive), sorted, never
// overlapping. The words themselves are never changed.
//
// Every renderer draws them through <HighlightedText> (editor when not
// typing, CardThumb, TextPanel thumbnails) so they look the same everywhere.
// Warped text (Arc, Wave…) draws letter by letter and shows no highlights.

export const HIGHLIGHT_SWATCHES = ['#FFE066', '#FFB3C7', '#B9F2C8', '#BFDBFE', '#FDC48A'];

// A marker band behind the words: a little shorter than the line, so it
// reads as a highlighter stroke rather than a box. `clone` repeats it on
// every line of a highlight that wraps.
export function highlightStyle(color) {
  return {
    backgroundImage: `linear-gradient(to bottom, transparent 16%, ${color} 16%, ${color} 90%, transparent 90%)`,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
}

// Sorted, inside the text, non-empty, and touching ranges of one colour
// joined.
export function cleanHighlights(list, length) {
  const out = [];
  const sorted = (Array.isArray(list) ? list : [])
    .map((h) => ({ start: Math.max(0, Math.min(length, h.start | 0)), end: Math.max(0, Math.min(length, h.end | 0)), color: h.color }))
    .filter((h) => h.end > h.start && typeof h.color === 'string')
    .sort((a, b) => a.start - b.start);
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && h.start <= last.end && last.color === h.color) last.end = Math.max(last.end, h.end);
    else if (last && h.start < last.end) out.push({ ...h, start: last.end }); // never overlap
    else out.push({ ...h });
  }
  return out.filter((h) => h.end > h.start);
}

// The highlights without the part between start and end.
export function removeHighlightRange(list, start, end) {
  const out = [];
  for (const h of list || []) {
    if (h.end <= start || h.start >= end) { out.push(h); continue; }
    if (h.start < start) out.push({ ...h, end: start });
    if (h.end > end) out.push({ ...h, start: end });
  }
  return out;
}

export function applyHighlight(list, start, end, color, length) {
  return cleanHighlights([...removeHighlightRange(list, start, end), { start, end, color }], length);
}

// Moves highlights along with an edit, found as the common start and end of
// the old and new text: text typed inside a highlight joins it, text typed
// just after it doesn't, deleted text takes its part of a highlight with it.
export function remapHighlights(list, oldText, newText) {
  if (!list?.length) return [];
  const a = oldText || '';
  const b = newText || '';
  if (a === b) return cleanHighlights(list, b.length);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const oldEnd = a.length - s;
  const newEnd = b.length - s;
  const delta = newEnd - oldEnd;
  const move = (pos, isEnd) => {
    if (pos < p || (pos === p && (isEnd || oldEnd > p))) return pos;
    if (pos >= oldEnd) return pos + delta;
    return isEnd ? newEnd : p;
  };
  return cleanHighlights(list.map((h) => ({ ...h, start: move(h.start, false), end: move(h.end, true) })), b.length);
}

// The text with its highlighted parts wrapped in marker spans.
export function HighlightedText({ text, highlights }) {
  const value = text || '';
  const list = cleanHighlights(highlights, value.length);
  if (!list.length) return value;
  const parts = [];
  let at = 0;
  list.forEach((h, i) => {
    if (h.start > at) parts.push(value.slice(at, h.start));
    parts.push(<span key={i} style={highlightStyle(h.color)}>{value.slice(h.start, h.end)}</span>);
    at = h.end;
  });
  if (at < value.length) parts.push(value.slice(at));
  return parts;
}

// The text box being typed into, so the Text panel can highlight the words
// selected in it: { elementId, highlightSelection(color | null) → boolean }.
// One at a time (only one box can be typed into); set and cleared by
// DraggableElement.
let activeEditor = null;
export function setActiveTextEditor(editor) { activeEditor = editor; }
export function clearActiveTextEditor(editor) { if (activeEditor === editor) activeEditor = null; }
export function getActiveTextEditor() { return activeEditor; }
