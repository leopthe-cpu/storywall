// Card layout engine for generated stories (AI Carousel Builder).
//
// Why it exists: generated text boxes used to sit at fixed heights (header at
// 53%, body at 63%) and each picked its own font size from a rough estimate.
// A long header grew into the body below it, and sizes jumped from card to
// card (17px headers next to 50px ones). This module measures the real text
// in the real font and stacks it, with ONE type scale for the whole story.
//
// Everything is in reference px on the 320×320 card, like the rest of the
// canvas code. Text boxes render with 2px padding and the line height rule in
// textLineHeight() (CardThumb, DraggableElement, TextPanel); measurements here
// must follow the same rules or the layout won't match what is drawn.

export const CARD = 320;
export const MARGIN = 24;
export const CONTENT_WIDTH = CARD - 2 * MARGIN; // 272
const BOX_PADDING = 2; // CardThumb/DraggableElement pad text boxes by 2px

// Body sizes tried for a story, largest first. Headers and titles are fixed
// steps above the body, so a story never has more than a few sizes. Body text
// doesn't go below 16: a card with more text than fits continues on the next
// card (whole sentences) instead of making the whole story smaller.
// Starts at 19 (was 18; Oz 2026-10-17: text could be slightly bigger). The
// floor stays 16: a 17 floor pushed templates and dense stories onto extra
// cards in the card lab.
export const BODY_SIZES = [19, 18, 17, 16];
export const SCALE = {
  header: 1.5,
  statement: 1.9,
  cover: 2.25,
};

// Line height of a text element: its own line_height when set (generated
// text sets it per role: tight headers, relaxed body), otherwise the old
// size-based rule. Every renderer uses this, so the editor, thumbnails and
// the published card always agree.
export function textLineHeight(fontSize, lineHeight) {
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  return fontSize >= 32 ? 1.05 : 1.3;
}

// Line heights for generated text, by role.
export const LINE_HEIGHT = { display: 1.08, header: 1.12, lead: 1.3, body: 1.42 };

let measureCtx = null;
function ctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

function fontString({ family, weight = '400', italic = false }, size) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"`;
}

// Breaks text into lines the way the renderers do (white-space: pre-wrap;
// overflow-wrap: break-word): explicit newlines first, then greedy word
// wrapping, and a word longer than the line is broken by characters.
export function wrapText(text, font, size, width) {
  const c = ctx();
  c.font = fontString(font, size);
  const transform = (s) => (font.uppercase ? s.toUpperCase() : s);
  const fits = (s) => c.measureText(transform(s)).width <= width;
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) { line = candidate; continue; }
      if (line) lines.push(line);
      if (fits(word)) { line = word; continue; }
      // Break an over-long word by characters.
      let chunk = '';
      for (const ch of word) {
        if (fits(chunk + ch)) chunk += ch;
        else { lines.push(chunk); chunk = ch; }
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

// Height of a rendered text box (padding included), in reference px.
// The measuring width is 2px narrower than the box's text area: canvas and
// DOM text widths differ by fractions of a pixel, and a line that wraps in
// the DOM but not here would make the box taller than planned.
export function measureBox(text, font, size, lineHeight, width = CONTENT_WIDTH) {
  const lines = wrapText(text, font, size, width - 2);
  return lines.length * size * textLineHeight(size, lineHeight) + 2 * BOX_PADDING;
}

// Splits text into sentences without changing a character, so sentences can
// move to a continuation card. Joining the pieces gives the original back.
export function splitSentences(text) {
  const parts = String(text).match(/[^.!?…]+(?:[.!?…]+["'”’)]*\s*|$)/g) || [String(text)];
  return parts.filter((p) => p.length > 0);
}

// Waits until the faces a style uses are loaded, so measurements use the
// real fonts and not a fallback. document.fonts.load() resolves empty when
// the @font-face rules aren't known yet (the Google Fonts stylesheet is still
// loading), so it keeps trying for up to 3 seconds. Resolves either way.
export async function loadStyleFonts(style, timeoutMs = 3000) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = [style.displayFont, style.bodyFont].map((f) => fontString(f, 24));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const loaded = await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => [])));
    if (loaded.every((faces) => faces.length > 0) || Date.now() > deadline) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}
