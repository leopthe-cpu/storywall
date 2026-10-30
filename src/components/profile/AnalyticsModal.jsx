import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from '@/components/icons';
import { getMe, filterPosts, myStoryAnalytics } from '@/api/storywallApi';
import SectionLoader from '@/components/ui/SectionLoader';
import { withTimeout } from '@/lib/imageOptimize';
import { summarizeViews } from '@/lib/storyAnalytics';

// The Premium analytics screen, first version (decisions 34, 50): a list of
// totals from the view counts (story and card views, all and unique), the
// most-read stories, views per card with a 30-day chart, and where most
// readers stop. Metrics that aren't collected yet are listed as coming.
// The data comes from my_story_analytics, which returns nothing to anyone
// without Premium.

const LOAD_TIMEOUT_MS = 15000;
const DAYS = 30;
const COMING = ['Reading time', 'Keywords people found you by', 'Profile visits, with city and time', 'Where your visitors came from'];

const fmt = (n) => Number(n || 0).toLocaleString();

// Views per day as a small line chart.
function Sparkline({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const w = 120;
  const h = 28;
  const step = daily.length > 1 ? w / (daily.length - 1) : w;
  const points = daily.map((d, i) => `${(i * step).toFixed(1)},${(h - 2 - (d.views / max) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Views over the last ${daily.length} days`} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StoryRow({ story }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...story.cards);
  return (
    <div className="rounded-2xl border border-gray-100 p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{story.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmt(story.views)} views · {fmt(story.unique)} unique</p>
        </div>
        <Sparkline daily={story.daily} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            {story.stopAt == null
              ? 'Not enough card views yet to see where readers stop.'
              : story.stopAt >= story.cards.length
                ? 'Most readers reach the last card.'
                : `Most readers stop after card ${story.stopAt}.`}
          </p>
          <div className="space-y-1">
            {story.cards.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-gray-400">Card {i + 1}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full" style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-gray-600 tabular-nums">{fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsModal({ onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [rows, posts] = await withTimeout((async () => {
        const user = await getMe();
        return Promise.all([
          myStoryAnalytics(DAYS),
          filterPosts({ author_id: user.id, status: 'published' }, '-created_at', 100),
        ]);
      })(), LOAD_TIMEOUT_MS);
      setSummary(summarizeViews(rows, posts, { days: DAYS }));
    } catch (e) {
      console.error('[AnalyticsModal] load failed:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-xl flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">Analytics</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading || loadError ? (
            <SectionLoader className="py-12" error={!loading && loadError} onRetry={load} />
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">Last {DAYS} days. Your own views aren&apos;t counted.</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Story views</p>
                  <p className="text-2xl font-semibold text-gray-900 tabular-nums">{fmt(summary.views)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Unique views</p>
                  <p className="text-2xl font-semibold text-gray-900 tabular-nums">{fmt(summary.unique)}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Most-read stories</p>
              {summary.stories.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No views yet. Share your wall to get your first readers.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {summary.stories.map((s) => <StoryRow key={s.post.id} story={s} />)}
                </div>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2">Coming soon</p>
              <ul className="text-sm text-gray-400 space-y-1">
                {COMING.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
