// Turns the daily view rows of my_story_analytics into what the Premium
// analytics screen lists (decisions 34, 50): totals, stories by views, each
// story's views per card and per day, and where most readers stop.

const STOP_SHARE = 0.5; // "stop" = the first card seen by under half of the readers of card 1

// A story's name for the list: its title, else the start of its first text
// (on any card: a cover can be a picture only).
export function storyLabel(post) {
  if (post?.title) return post.title;
  const first = (post?.cards || []).flatMap((c) => c.elements || []).find((e) => e.type === 'text' && e.content?.trim());
  const text = first?.content?.trim().replace(/\s+/g, ' ');
  if (!text) return 'Untitled story';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

// The last `days` days, oldest first, as YYYY-MM-DD (UTC, like the counts).
export function lastDays(days, today = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function summarizeViews(rows, posts, { days = 30, today } = {}) {
  const byPost = new Map((posts || []).map((p) => [p.id, p]));
  const range = lastDays(days, today);
  const stats = new Map();
  for (const r of rows || []) {
    const post = byPost.get(r.post_id);
    if (!post) continue; // deleted or no longer published
    if (!stats.has(r.post_id)) stats.set(r.post_id, { post, views: 0, unique: 0, cards: new Map(), daily: new Map() });
    const s = stats.get(r.post_id);
    if (r.card_index === -1) {
      s.views += r.views;
      s.unique += r.unique_views;
      s.daily.set(r.day, (s.daily.get(r.day) || 0) + r.views);
    } else {
      s.cards.set(r.card_index, (s.cards.get(r.card_index) || 0) + r.views);
    }
  }
  const stories = [...stats.values()].map((s) => {
    const count = Math.max(s.post.cards?.length || 0, ...[...s.cards.keys()].map((i) => i + 1));
    const cards = Array.from({ length: count }, (_, i) => s.cards.get(i) || 0);
    const first = cards[0] || 0;
    let stopAt = null; // 1-based number of the last card most readers saw
    if (first > 0 && cards.length > 1) {
      const drop = cards.findIndex((v, i) => i > 0 && v < first * STOP_SHARE);
      stopAt = drop === -1 ? cards.length : drop;
    }
    return {
      post: s.post,
      label: storyLabel(s.post),
      views: s.views,
      unique: s.unique,
      cards,
      stopAt,
      daily: range.map((day) => ({ day, views: s.daily.get(day) || 0 })),
    };
  }).sort((a, b) => b.views - a.views);
  return {
    views: stories.reduce((n, s) => n + s.views, 0),
    unique: stories.reduce((n, s) => n + s.unique, 0),
    stories,
  };
}

// Names for traffic sources (decision 53): share-link tags, "direct", and
// otherwise the referring site's domain as is.
const SOURCE_NAMES = { li: 'LinkedIn', ig: 'Instagram', x: 'X', email: 'Email', link: 'Copied link', direct: 'Direct or unknown' };
export const sourceName = (source) => SOURCE_NAMES[source] || source;

// Story views per source over the last `days` days, most first, for the
// published stories in `posts`: [{ source, name, views }].
export function summarizeSources(rows, posts, { days = 30, today } = {}) {
  const published = new Set((posts || []).map((p) => p.id));
  const since = lastDays(days, today)[0];
  const totals = new Map();
  for (const r of rows || []) {
    if (!published.has(r.post_id) || r.day < since) continue;
    totals.set(r.source, (totals.get(r.source) || 0) + r.views);
  }
  return [...totals.entries()]
    .map(([source, views]) => ({ source, name: sourceName(source), views }))
    .sort((a, b) => b.views - a.views);
}
