import { withVia } from '@/lib/visitSource';

// The share screen ("Share your story", decision 53): the story's link and
// a caption built from the author's own words. Nothing here rewrites them:
// the caption is their cover headline as written, the link and their skill
// tags as hashtags, and they can edit it before copying.

// The author's wall, opening on this story (route /:username/:storyId),
// tagged ?via=link so its visits show as "Copied link" in analytics.
export function storyShareUrl(username, postId, origin = window.location.origin) {
  return withVia(`${origin}/${username}/${postId}`);
}

// The cover headline: the first text on the first card, as written (a
// cover can be a picture only, then the story's title, else nothing).
export function coverHeadline(post) {
  const cover = (post?.cards || [])[0];
  const text = (cover?.elements || []).find((e) => e?.type === 'text' && e.content?.trim());
  return (text?.content || post?.title || '').trim();
}

// "Product Management" → "#ProductManagement". Letters and digits only, in
// any alphabet; a tag with neither gives nothing.
export function hashtag(tag) {
  const words = String(tag || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return '';
  return `#${words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;
}

export function storyCaption(post, url) {
  const tags = [...new Set((post?.tags || []).map(hashtag).filter(Boolean))].join(' ');
  return [coverHeadline(post), url, tags].filter(Boolean).join('\n\n');
}

// "Don't show this again" after publishing. Kept in this browser only (a
// convenience, not a setting): on another device the screen shows again,
// and the ⋯ menu always opens it.
const SKIP_KEY = 'storywall:skip-share-after-publish';

export function shareAfterPublishSkipped() {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
}

export function setShareAfterPublishSkipped(skip) {
  try {
    if (skip) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
  } catch { /* private window: it simply shows again next time */ }
}
