// Word-for-word check for structured stories, in plain code rather than a
// second AI call, so it can't be argued with:
//   - every sentence the user wrote appears, unchanged, in some card;
//   - card bodies hold only the user's own sentences (a rewritten or invented
//     body sentence is removed; the original goes back in instead).
// Headers are exempt: the AI may write a short hook or title (CLAUDE.md:
// "never rewrite the user's words, only restructure into cards and add a
// hook/title").
//
// "Unchanged" ignores only what doesn't change the words: runs of whitespace,
// straight vs curly quotes and apostrophes.

export type CoverageCard = { text: string | null; subtitle: string | null; [k: string]: unknown };

export function normalize(s: string): string {
  return s
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sentences of the user's text, in order. Line breaks also end a sentence
// (notes are often written as lines without full stops).
export function userSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of String(text).split(/\n+/)) {
    const parts = line.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) || [];
    for (const p of parts) {
      const s = p.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// Whole-card text used for coverage: header and body together, so a sentence
// kept as a header ("I wasn't convinced.") counts as covered.
function cardText(c: CoverageCard): string {
  return normalize([c.text, c.subtitle].filter(Boolean).join(' '));
}

// User sentences that don't appear word for word in any card.
export function findMissing(text: string, cards: CoverageCard[]): string[] {
  const all = cards.map(cardText).join(' \u0000 ');
  return userSentences(text).filter((s) => !all.includes(normalize(s)));
}

// Removes body sentences that aren't whole sentences of the user's:
// paraphrases, invented lines, and fragments of a sentence that was cut in
// two (the full sentence is restored afterwards, so a fragment would repeat
// it). One exception: a title that starts a sentence and the body that
// finishes it ("Within two months," + "second orders went up.") count as
// that whole sentence. Returns how many body sentences were removed.
export function removeInventedBody(text: string, cards: CoverageCard[]): number {
  const whole = new Set(userSentences(text).map(normalize));
  let removed = 0;
  for (const c of cards) {
    if (!c.subtitle) continue;
    const kept = userSentences(c.subtitle).filter((s, i) => {
      const ok = whole.has(normalize(s)) ||
        (i === 0 && !!c.text && whole.has(normalize(`${c.text} ${s}`)));
      if (!ok) removed++;
      return ok;
    });
    c.subtitle = kept.join(' ') || null;
  }
  return removed;
}

// Puts each missing sentence back where it belongs: right after the user's
// previous sentence (in that sentence's card body), or before the next one
// if it's the first. Keeps the user's order; never drops anything.
export function restoreMissing(text: string, cards: CoverageCard[]): void {
  const sentences = userSentences(text);
  const missing = new Set(findMissing(text, cards));
  if (!missing.size || !cards.length) return;
  const cardOf = (s: string) => cards.findIndex((c) => cardText(c).includes(normalize(s)));

  sentences.forEach((s, i) => {
    if (!missing.has(s)) return;
    // Nearest earlier sentence that is already placed.
    for (let j = i - 1; j >= 0; j--) {
      const k = cardOf(sentences[j]);
      if (k < 0) continue;
      const c = cards[k];
      const body = c.subtitle || '';
      // The stored body keeps the user's exact characters: look for the
      // previous sentence as written, and only fall back to the end of the body.
      const at = body.indexOf(sentences[j]);
      if (at >= 0) {
        const end = at + sentences[j].length;
        c.subtitle = `${body.slice(0, end)} ${s}${body.slice(end)}`;
      } else if (body && normalize(body).includes(normalize(sentences[j]))) {
        c.subtitle = `${body} ${s}`;
      } else {
        // The previous sentence is the header: the body starts with this one.
        c.subtitle = `${s}${body ? ' ' + body : ''}`;
      }
      missing.delete(s);
      return;
    }
    // No earlier sentence placed: put it at the start of the first body.
    const k = Math.max(0, cards.findIndex((c) => c.subtitle));
    cards[k].subtitle = `${s}${cards[k].subtitle ? ' ' + cards[k].subtitle : ''}`;
    missing.delete(s);
  });
}

// Drops titles that are only the start or end of one of the user's sentences
// when that sentence is shown whole in a card body: the title would repeat
// it. Short hooks, and short sentences used as titles, are kept.
export function dropRepeatedTitles(text: string, cards: CoverageCard[]): void {
  const whole = userSentences(text).map(normalize);
  const bodies = cards.map((c) => normalize(c.subtitle || '')).join(' \u0000 ');
  for (const c of cards) {
    if (!c.text) continue;
    const t = normalize(c.text);
    if (whole.includes(t)) continue;
    const piece = whole.find((w) => w !== t && (w.startsWith(t) || w.endsWith(t)));
    if (piece && bodies.includes(piece)) c.text = null;
  }
}
