import { useLayoutEffect, useRef } from 'react';

// Renders text with a letter-level warp (doc 108 Phase 2: Arc, Wave, Stairs,
// Bulge). Every character becomes its own inline-block box; after layout we
// measure where each one actually landed, group them into the visual lines
// the browser produced (wrapping, alignment, letter-spacing and font all
// already applied), and give each character a transform based on its
// position within its line.
//
// Everything is measured in the element's own local layout pixels
// (offsetLeft/offsetTop and the computed font-size ignore ancestor
// transforms), so the result looks identical at any render scale — the
// editor canvas, the 64px gallery thumbnails, and CardThumb's single outer
// scale() for published cards all get the same shape.
//
// Words are kept together in a nowrap group so the browser still only wraps
// at spaces, never mid-word. Underline/strikethrough is drawn per letter
// (passed in as `decoration`, and the caller must NOT also set it on the
// container): a decoration set on an ancestor would also be painted under
// the unmoved spaces between words, leaving stray dashes along the original
// baseline once the letters move off it.
//
// Only used for display: the editor switches back to plain text while a box
// is being typed into, since a contentEditable full of per-letter spans
// would be unusable.

function curveTransform(warp, a, t, fontSize, halfWidth) {
  // a: -1..1 strength (sign = direction). t: -1..1 position in the line.
  if (warp === 'arc') {
    // Parabola through the line's ends, apex at the middle. Positive arches
    // up (rainbow), negative curves down (smile). Each letter is rotated to
    // the curve's slope so it stays perpendicular to the baseline.
    const A = a * halfWidth * 0.5;
    return { y: -A * (1 - t * t), rot: Math.atan((2 * A * t) / halfWidth) };
  }
  if (warp === 'wave') {
    // Two full waves across the line; the sign flips the phase.
    const cycles = 2;
    const A = a * fontSize * 0.6;
    const phase = Math.PI * t * cycles;
    return { y: A * Math.sin(phase), rot: Math.atan(((A * Math.PI * cycles) / halfWidth) * Math.cos(phase)) };
  }
  if (warp === 'stairs') {
    // Each letter steps up (or down) from the one before; no rotation, so it
    // reads as discrete steps rather than a slanted baseline.
    return { y: -a * fontSize * 1.1 * t, rot: 0 };
  }
  return { y: 0, rot: 0 };
}

function rowBounds(row) {
  const left = row.items[0].left;
  const right = Math.max(...row.items.map((m) => m.left + m.width));
  return { left, right, center: (left + right) / 2, halfWidth: Math.max((right - left) / 2, 1) };
}

// sharedHalfWidth: the widest line's half-width. Arc/Wave/Stairs measure
// every line's letters against this one shared width (each line still
// centred on itself), so multi-line text bends as parallel curves — a short
// line sits on the same curve as a long one instead of bending less, which
// made shorter lines collide with the more-lifted longer line below them.
function layoutRow(row, warp, a, fontSize, sharedHalfWidth) {
  const items = row.items;
  const { left, center, halfWidth } = rowBounds(row);

  if (warp === 'bulge') {
    // Letters grow toward the middle of the line (or shrink, when negative),
    // anchored near the baseline. Growing letters in place would overlap
    // their neighbours, so the line is re-flowed: each letter is pushed out
    // by however much the letters between it and the middle grew (or pulled
    // in when shrinking), keeping the original gaps between words and the
    // line's overall centre fixed.
    const scales = items.map((m) => {
      const t = Math.max(-1, Math.min(1, (m.left + m.width / 2 - center) / halfWidth));
      return Math.max(0.2, 1 + a * 0.8 * (1 - t * t));
    });
    const newCenters = [];
    let cursor = left;
    items.forEach((m, i) => {
      if (i > 0) cursor += m.left - (items[i - 1].left + items[i - 1].width); // original gap
      newCenters.push(cursor + (m.width * scales[i]) / 2);
      cursor += m.width * scales[i];
    });
    const shift = center - (left + cursor) / 2;
    items.forEach((m, i) => {
      const dx = newCenters[i] + shift - (m.left + m.width / 2);
      m.el.style.transformOrigin = '50% 85%';
      m.el.style.transform = `translateX(${dx.toFixed(2)}px) scale(${scales[i].toFixed(3)})`;
    });
    return;
  }

  for (const m of items) {
    const t = Math.max(-1, Math.min(1, (m.left + m.width / 2 - center) / sharedHalfWidth));
    const { y, rot } = curveTransform(warp, a, t, fontSize, sharedHalfWidth);
    m.el.style.transformOrigin = '50% 60%';
    m.el.style.transform = `translateY(${y.toFixed(2)}px) rotate(${rot.toFixed(4)}rad)`;
  }
}

export default function WarpedText({ text, warp, amount, decoration = 'none' }) {
  const rootRef = useRef(null);
  const lines = String(text ?? '').split('\n');

  // Runs after every render (cheap: a few dozen reads/writes) so any change
  // that moves letters — font, size, spacing, width, alignment, content —
  // is picked up without having to enumerate them all as dependencies.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const apply = () => {
      const chars = Array.from(root.querySelectorAll('[data-wc]'));
      if (!chars.length) return;
      const fontSize = parseFloat(window.getComputedStyle(root).fontSize) || 16;
      const a = Math.max(-1, Math.min(1, (amount || 0) / 100));

      // Group into the browser's visual lines by vertical position.
      const measured = chars
        .map((el) => ({ el, top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth }))
        .sort((p, q) => p.top - q.top || p.left - q.left);
      const rows = [];
      for (const m of measured) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(m.top - row.top) < fontSize * 0.5) row.items.push(m);
        else rows.push({ top: m.top, items: [m] });
      }
      const sharedHalfWidth = Math.max(...rows.map((r) => rowBounds(r).halfWidth));
      for (const row of rows) layoutRow(row, warp, a, fontSize, sharedHalfWidth);
    };

    apply();
    // Web fonts often finish loading after first paint and change every
    // letter's width; a resize also re-wraps lines. Re-measure on both.
    let cancelled = false;
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) apply(); });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => apply());
      ro.observe(root);
    }
    return () => { cancelled = true; ro?.disconnect(); };
  });

  const charStyle = { display: 'inline-block', textDecoration: decoration };
  return (
    <span ref={rootRef} style={{ display: 'block' }}>
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }}>
          {line === ''
            ? '​'
            : line.split(/( +)/).map((tok, ti) => (
              /^ +$/.test(tok) || tok === ''
                ? tok
                : (
                  <span key={ti} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {Array.from(tok).map((ch, ci) => (
                      <span key={ci} data-wc="" style={charStyle}>{ch}</span>
                    ))}
                  </span>
                )
            ))}
        </span>
      ))}
    </span>
  );
}
