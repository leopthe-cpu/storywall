import { REFERENCE_CARD_SIZE, SAFE_ZONE_INSET, getCardSize } from '@/lib/cardGeometry';
import { getTextBoxLayout } from '@/lib/textLayout';
import { getImageDisplayDims } from '@/lib/imageLayout';
import { measureBox } from '@/lib/cardLayout';

// Switching one card's size (decision 45, Oz 2026-10-26/27). Every element
// keeps its position as a % of the card (50% down stays 50% down) and its
// own shape: widths, heights, crops and font sizes are reference px and
// don't change, so nothing stretches. The card is 320 wide in every size,
// so only vertical positions can run off. An element that sat fully on the
// old card and would hang off the new one is moved back inside (text to
// the safe zone, like the editor keeps it); one taller than the new card is
// centred on it. Elements that were already partly off the card (a picture
// dragged half out on purpose) keep their position. No note is shown.

const W = REFERENCE_CARD_SIZE;

// An element's box in reference px on a card `h` high: { top, height, left,
// width }. Text boxes with no stored height are measured the way the layout
// engine measures generated text (real font, real wrapping).
function elementBox(el, h) {
  if (el.type === 'text') {
    const { xPct, yPct, width, height } = getTextBoxLayout(el, h);
    let boxH = height;
    if (!boxH) {
      const size = parseInt(el.font_size, 10) || 14;
      const font = { family: el.font_family || 'Inter', weight: el.font_weight || '400', italic: !!el.font_italic };
      const text = el.text_transform === 'uppercase' ? (el.content || '').toUpperCase() : (el.content || '');
      // The renderers wrap text at the box width minus 4 px of padding;
      // measureBox wraps at its width minus 2.
      boxH = text.trim() ? measureBox(text, font, size, el.line_height, width - 2) : size * 1.3 + 4;
    }
    return { left: (xPct / 100) * W, top: (yPct / 100) * h, width, height: boxH };
  }
  let width;
  let height;
  if (el.type === 'audio') {
    width = el.displayWidth ?? 220;
    height = el.displayHeight ?? 60;
  } else {
    const dims = getImageDisplayDims(el, W);
    width = Math.max(20, dims.displayWidth - (el.clipLeft || 0) - (el.clipRight || 0));
    height = Math.max(20, dims.displayHeight - (el.clipTop || 0) - (el.clipBottom || 0));
  }
  return { left: ((el.x ?? 0) / 100) * W, top: ((el.y ?? 0) / 100) * h, width, height };
}

// The card at its new size: { card, moved } where `moved` lists the ids of
// the elements that had to move back inside.
export function resizeCard(card, fromSize, toSize) {
  const oldH = getCardSize(fromSize).height;
  const newH = getCardSize(toSize).height;
  const moved = [];
  const elements = (card.elements || []).map((el) => {
    const before = elementBox(el, oldH);
    const wasOnCard = before.top >= -0.5 && before.left >= -0.5
      && before.top + before.height <= oldH + 0.5 && before.left + before.width <= W + 0.5;
    if (!wasOnCard) return el;
    const inset = el.type === 'text' ? SAFE_ZONE_INSET : 0;
    const top = (before.top / oldH) * newH;
    let newTop = top;
    if (before.height > newH - 2 * inset) newTop = (newH - before.height) / 2;
    else if (top + before.height > newH - inset) newTop = newH - inset - before.height;
    else if (top < inset && before.top >= inset) newTop = inset;
    if (Math.abs(newTop - top) < 0.05) return el;
    moved.push(el.id);
    return { ...el, y: Math.round((newTop / newH) * 10000) / 100 };
  });
  return { card: { ...card, card_size: getCardSize(toSize).id, elements }, moved };
}
