import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { getClientIP, isRateLimited, isRateLimitedShared } from '../_shared/rateLimit.ts';

// Counts one view of a published story (card_index omitted or -1) or of one
// of its cards (card_index 0..). Decisions 34, 50, 51. Callable without
// signing in, like getPublicProfile; the app calls it when a story is seen
// on screen and when a card is shown.
//
// - The story's owner never counts: a signed-in caller who wrote the story
//   is skipped.
// - Unique views: the viewer's address and browser are passed to
//   record_story_view, which keeps only a hash mixed with a secret for the
//   day (both deleted after the day). Nothing personal is stored.
// - Off unless the VIEW_TRACKING_ENABLED secret is "true": tracking must not
//   go live before the privacy notice is checked (decision 34), so it is
//   switched on per project (staging first).
// Body: { post_id, card_index?, source? }  →  204, always (a visitor never
// needs an answer, and failures must not show on the wall).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Where a story view came from (decision 53): a share-link tag, "direct",
// or the domain of the site the visitor came from. Anything else is dropped
// (the view still counts, without a source).
const SOURCE_TAGS = new Set(['li', 'ig', 'x', 'email', 'link', 'direct']);
const DOMAIN = /^(?=.{1,100}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const cleanSource = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SOURCE_TAGS.has(s) || DOMAIN.test(s) ? s : null;
};
const done = () => new Response(null, { status: 204 });

export default {
  fetch: withSupabase({ auth: ['user', 'publishable'] }, async (req, ctx) => {
    try {
      if (Deno.env.get('VIEW_TRACKING_ENABLED') !== 'true') return done();
      // A wall with many stories and cards sends a burst of these, so the
      // limits are higher than getPublicProfile's.
      const ip = getClientIP(req);
      if (isRateLimited(ip, 120) || await isRateLimitedShared(ctx.supabaseAdmin, 'view', ip, 300)) return done();

      const body = await req.json().catch(() => ({}));
      const postId = String(body?.post_id || '');
      const cardIndex = body?.card_index == null ? -1 : Number(body.card_index);
      if (!UUID.test(postId) || !Number.isInteger(cardIndex) || cardIndex < -1 || cardIndex > 200) return done();

      const { data: post, error } = await ctx.supabaseAdmin
        .from('posts').select('author_id, status, cards').eq('id', postId).maybeSingle();
      if (error) throw error;
      if (!post || post.status !== 'published') return done();
      if (cardIndex >= (Array.isArray(post.cards) ? post.cards.length : 0)) return done();
      const me = ctx.authMode === 'user' ? ctx.userClaims?.id ?? null : null;
      if (me && me === post.author_id) return done();

      const visitor = `${ip}|${req.headers.get('user-agent') || ''}`;
      const { error: recordError } = await ctx.supabaseAdmin.rpc('record_story_view', {
        p_post_id: postId, p_card_index: cardIndex, p_visitor: visitor,
        p_source: cardIndex === -1 ? cleanSource(body?.source) : null,
      });
      if (recordError) throw recordError;
      return done();
    } catch (error) {
      console.log(`[recordView] error: ${(error as Error)?.message || error}`);
      return done();
    }
  }),
};
