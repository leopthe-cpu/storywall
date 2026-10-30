import { invokeFunction } from '@/api/storywallApi';
import { visitSource } from '@/lib/visitSource';

// Story and card views (decisions 34, 50, 51). The wall reports a story once
// it has been at least half on screen for a second, and each card once it
// is shown while its story is on screen. Each is sent at most once per page
// load; the server (recordView) skips the owner and does the counting.
// Failures are ignored: a missed view must never show on the wall. A story
// view also says where the visit came from (visitSource, decision 53).

export const VIEW_VISIBLE_RATIO = 0.5;
export const VIEW_VISIBLE_MS = 1000;

const sent = new Set();

export function recordView(postId, cardIndex = -1) {
  const key = `${postId}:${cardIndex}`;
  if (!postId || sent.has(key)) return;
  sent.add(key);
  const body = { post_id: postId, card_index: cardIndex };
  if (cardIndex === -1) body.source = visitSource();
  invokeFunction('recordView', body).catch(() => {});
}
