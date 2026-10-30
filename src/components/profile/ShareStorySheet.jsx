import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { X, Link, Copy, Check, Download } from '@/components/icons';
import CardThumb from '@/components/creator/CardThumb';
import { CardFormatProvider } from '@/components/creator/CardFormatContext';
import { cardAspectRatio, cardSizeOf } from '@/lib/cardGeometry';
import { storyShareUrl, storyCaption, coverHeadline, shareAfterPublishSkipped, setShareAfterPublishSkipped } from '@/lib/shareStory';

const DownloadCardsButton = lazy(() => import('@/components/creator/DownloadCardsButton'));

const PREVIEW_SIZE = 96;

// "Share your story" (decision 53): opened on the wall right after a
// publish (with "Don't show this again") and from a story's ⋯ menu. Copy
// link and an editable caption for everyone; card downloads for Premium,
// shown to everyone else with a Premium label rather than hidden. Owner-only.
export default function ShareStorySheet({ post, username, isPremium, afterPublish = false, onClose }) {
  const url = storyShareUrl(username, post.id);
  const [caption, setCaption] = useState(() => storyCaption(post, url));
  const [copied, setCopied] = useState(null); // 'link' | 'caption'
  const [copyFailed, setCopyFailed] = useState(false);
  const [skip, setSkip] = useState(shareAfterPublishSkipped);
  const [premiumNote, setPremiumNote] = useState(false);

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      // Clipboard blocked (old browser, no permission): the link and the
      // caption stay on screen to copy by hand.
      setCopyFailed(true);
    }
  };

  const toggleSkip = (e) => {
    setSkip(e.target.checked);
    setShareAfterPublishSkipped(e.target.checked);
  };

  const cover = (post.cards || [])[0];
  const button = 'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors';

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        role="dialog"
        aria-label="Share your story"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">Share your story</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            {cover && (
              <div
                className="flex-shrink-0 rounded-lg overflow-hidden border border-gray-100"
                style={{ width: PREVIEW_SIZE, aspectRatio: cardAspectRatio(cardSizeOf(cover, post.card_size)) }}
              >
                <CardFormatProvider value={post.card_size}>
                  <CardThumb card={cover} displaySize={PREVIEW_SIZE} tokens={post.color_tokens} />
                </CardFormatProvider>
              </div>
            )}
            <div className="min-w-0">
              {afterPublish && <p className="text-sm font-medium text-gray-900">Your story is live.</p>}
              <p className="text-xs text-gray-500 break-all mt-0.5">{url}</p>
            </div>
          </div>

          <button type="button" onClick={() => copy('link', url)} className={`${button} bg-gray-900 text-white hover:bg-gray-800`}>
            {copied === 'link' ? <Check size={16} /> : <Link size={16} />}
            <span>{copied === 'link' ? 'Link copied' : 'Copy link'}</span>
          </button>

          <div>
            <label htmlFor="share-caption" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Caption</label>
            <textarea
              id="share-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
            <button type="button" onClick={() => copy('caption', caption)} className={`${button} mt-2 border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              {copied === 'caption' ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied === 'caption' ? 'Caption copied' : 'Copy caption'}</span>
            </button>
            {copyFailed && <p className="mt-2 text-xs text-red-500">Couldn&apos;t copy here. Select the text and copy it by hand.</p>}
          </div>

          <div className="pt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Download</p>
            {isPremium ? (
              <Suspense fallback={null}>
                <CardFormatProvider value={post.card_size}>
                  <DownloadCardsButton
                    key={post.id}
                    cards={post.cards}
                    tokens={post.color_tokens}
                    title={post.title || coverHeadline(post)}
                    label="Download for Instagram (images)"
                  />
                </CardFormatProvider>
              </Suspense>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPremiumNote(true)}
                  className={`${button} border border-gray-200 text-gray-400`}
                >
                  <Download size={16} />
                  <span>Download for Instagram (images)</span>
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Premium</span>
                </button>
                {premiumNote && <p className="mt-2 text-xs text-gray-500">Card downloads come with Premium.</p>}
              </>
            )}
          </div>

          {afterPublish && (
            <label className="flex items-center gap-2 text-sm text-gray-500 pt-1">
              <input type="checkbox" checked={skip} onChange={toggleSkip} className="rounded border-gray-300" />
              Don&apos;t show this again after publishing
            </label>
          )}
        </div>
      </motion.div>
    </div>
  );
}
