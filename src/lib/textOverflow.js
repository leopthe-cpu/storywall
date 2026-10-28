import { SAFE_ZONE_INSET } from '@/lib/cardGeometry';
import { measureBox, textLineHeight } from '@/lib/cardLayout';

// Pasted text that doesn't fit its box even at the smallest typing size
// (Oz, 2026-10-28): the box keeps what fits and the rest continues on new
// cards placed right after it, instead of the paste being thrown away. The
// words are never changed, only cut between them.

// Smallest font size typing or pasting shrinks a text box to.
export const MIN_TYPING_FONT = 8;

// Where to cut `text` so that at most its first `fit` characters stay. The
// end of a sentence or paragraph is preferred, if one is in the last 40% of
// that part (a card left mostly empty would be worse than a sentence running
// on); otherwise the last space or line break, so no word is broken; if
// there's none, right at `fit`. Returns [kept, rest]; the rest loses the
// whitespace at the cut, nothing else.
export function cutAtWord(text, fit) {
  if (fit >= text.length) return [text, ''];
  let cut = fit;
  const head = text.slice(0, fit + 1);
  const lastSpace = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'));
  if (lastSpace > 0) cut = lastSpace;
  const ends = [...head.matchAll(/[.!?…]["'”’)]*(?=\s)|\n/g)];
  const lastEnd = ends.length ? ends[ends.length - 1] : null;
  if (lastEnd) {
    const at = lastEnd.index + lastEnd[0].length;
    if (at >= fit * 0.6 && at <= fit) cut = at;
  }
  return [text.slice(0, cut).replace(/\s+$/, ''), text.slice(cut).replace(/^\s+/, '')];
}

// Splits `text` into the pieces that go on continuation cards for a text
// box styled like `el`, each piece at the top of a card `cardHeight` high,
// as wide as the box. Each piece gets the largest size, up to `maxSize`,
// at which it fits; only pieces that are cut (all but the last) end up at
// the smallest size. Returns [{ text, size }]. Measured with the real font
// (measureBox, like the layout engine), with one spare line so the canvas
// and the DOM wrapping a word differently can't push the text off the card.
export function splitForCards(text, el, width, cardHeight, maxSize) {
  const font = { family: el.font_family || 'Inter', weight: el.font_weight || '400', italic: !!el.font_italic, uppercase: el.text_transform === 'uppercase' };
  const room = cardHeight - 2 * SAFE_ZONE_INSET;
  const fitsAt = (t, size) => measureBox(t, font, size, el.line_height, width - 2) + size * textLineHeight(size, el.line_height) <= room;
  const top = Math.max(MIN_TYPING_FONT, maxSize);
  const pieces = [];
  let rest = text;
  while (rest) {
    let size = null;
    for (let s = top; s >= MIN_TYPING_FONT; s--) if (fitsAt(rest, s)) { size = s; break; }
    if (size) { pieces.push({ text: rest, size }); break; }
    // Longest start of `rest` that fits at the smallest size.
    let lo = 1, hi = rest.length - 1, fit = 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fitsAt(rest.slice(0, mid), MIN_TYPING_FONT)) { fit = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    const [kept, next] = cutAtWord(rest, fit);
    pieces.push({ text: kept, size: MIN_TYPING_FONT });
    rest = next;
  }
  return pieces;
}
