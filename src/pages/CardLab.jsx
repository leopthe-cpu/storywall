import { useEffect, useRef, useState } from 'react';
import CardThumb from '@/components/creator/CardThumb';
import { AI_STYLE_TEMPLATES, buildAICards } from '@/lib/aiStyleTemplates';
import { CARD, MARGIN } from '@/lib/cardLayout';
import { CARD_LAB_FIXTURES } from '@/dev/cardLabFixtures';

// Card lab (development only, see App.jsx): runs the test stories through
// buildAICards in every style and checks each rendered card. Results are on
// window.__cardLab for scripted runs (Playwright) and shown on the page.
//
// Checks, on the rendered DOM in reference px:
// - text boxes don't overlap each other
// - text stays inside the margins (a 4px tolerance for glyph overhang)
// - text doesn't run into an inset picture
// - at most 3 text sizes per card, none below 16px (sizes vary from card
//   to card on purpose: text steps up where the card has room)

const DISPLAY = 280;
const TOLERANCE = 4;

function checkCard(node) {
  const scale = DISPLAY / CARD;
  const base = node.getBoundingClientRect();
  const toRef = (r) => ({
    left: (r.left - base.left) / scale, top: (r.top - base.top) / scale,
    right: (r.right - base.left) / scale, bottom: (r.bottom - base.top) / scale,
  });
  const texts = [...node.querySelectorAll('.whitespace-pre-wrap')].map((el) => toRef(el.getBoundingClientRect()));
  const images = [...node.querySelectorAll('img')].map((el) => toRef(el.parentElement.getBoundingClientRect()))
    .filter((r) => r.right - r.left < CARD - 1); // full-bleed pictures sit under text on purpose
  const problems = [];
  texts.forEach((t, i) => {
    if (t.left < MARGIN - TOLERANCE || t.right > CARD - MARGIN + TOLERANCE
      || t.top < MARGIN - TOLERANCE || t.bottom > CARD - MARGIN + TOLERANCE) {
      problems.push(`text ${i + 1} outside the margins`);
    }
    texts.slice(i + 1).forEach((u, j) => {
      if (t.left < u.right && u.left < t.right && t.top < u.bottom - 1 && u.top < t.bottom - 1) {
        problems.push(`text ${i + 1} overlaps text ${i + j + 2}`);
      }
    });
    images.forEach((im) => {
      if (t.top < im.bottom - 1 && im.top < t.bottom - 1 && t.left < im.right && im.left < t.right) {
        problems.push(`text ${i + 1} runs into the picture`);
      }
    });
  });
  return problems;
}

export default function CardLab() {
  const [runs, setRuns] = useState([]);
  const [results, setResults] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    (async () => {
      const out = [];
      for (const [fixture, story] of Object.entries(CARD_LAB_FIXTURES)) {
        for (const style of AI_STYLE_TEMPLATES) {
          const { cards, tokens } = await buildAICards(story, style);
          out.push({ key: `${fixture}/${style.id}`, fixture, style: style.name, cards, tokens });
        }
      }
      setRuns(out);
    })();
  }, []);

  useEffect(() => {
    if (!runs.length) return;
    // Let fonts and pictures settle before measuring.
    const t = setTimeout(async () => {
      await document.fonts.ready;
      const res = runs.map((run) => {
        const nodes = rootRef.current.querySelectorAll(`[data-run="${run.key}"] [data-card]`);
        const sizes = new Set(run.cards.flatMap((c) => c.elements.filter((e) => e.type === 'text').map((e) => Number(e.font_size))));
        const cards = [...nodes].map((n, i) => {
          const problems = checkCard(n);
          const cardSizes = new Set((run.cards[i]?.elements || []).filter((e) => e.type === 'text').map((e) => Number(e.font_size)));
          if (cardSizes.size > 3) problems.push(`${cardSizes.size} text sizes`);
          return { card: i + 1, problems };
        });
        const storyProblems = [];
        if ([...sizes].some((s) => s < 16)) storyProblems.push('text below 16px');
        return { run: run.key, cardCount: run.cards.length, sizes: [...sizes].sort((a, b) => a - b), storyProblems, cards: cards.filter((c) => c.problems.length) };
      });
      window.__cardLab = res;
      setResults(res);
    }, 1500);
    return () => clearTimeout(t);
  }, [runs]);

  const byKey = Object.fromEntries((results || []).map((r) => [r.run, r]));
  return (
    <div ref={rootRef} className="min-h-screen bg-neutral-100 p-6 space-y-10">
      <h1 className="text-2xl font-semibold">Card lab</h1>
      {!results && <p>Laying out and checking…</p>}
      {runs.map((run) => {
        const r = byKey[run.key];
        const ok = r && !r.storyProblems.length && !r.cards.length;
        return (
          <section key={run.key} data-run={run.key} className="space-y-2">
            <h2 className="font-semibold">
              {run.fixture} · {run.style} · {run.cards.length} cards
              {r && <span className={ok ? 'text-green-700' : 'text-red-700'}> · {ok ? 'all checks pass' : 'problems found'} · sizes {r.sizes.join('/')}</span>}
            </h2>
            {r && !ok && (
              <ul className="text-sm text-red-700">
                {r.storyProblems.map((p) => <li key={p}>{p}</li>)}
                {r.cards.map((c) => <li key={c.card}>card {c.card}: {c.problems.join(', ')}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              {run.cards.map((card) => (
                <div key={card.id} data-card style={{ width: DISPLAY, height: DISPLAY }} className="rounded-xl overflow-hidden">
                  <CardThumb card={card} tokens={run.tokens} displaySize={DISPLAY} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
