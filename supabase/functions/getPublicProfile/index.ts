import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { getClientIP, isRateLimited } from '../_shared/rateLimit.ts';
import { isAllowedUsername, normalizeUsername } from '../_shared/username.ts';

// A wall's public data. Port of base44/functions/getPublicProfile.
// Callable without signing in (anyone with a wall link), rate-limited per IP.
// Returns { status: 'public' | 'private' | 'not_found', user, posts }.
// Privacy (decision 14): only the fields the wall shows. Never the e-mail,
// role or a story's private notes; a private profile reveals only its
// username (Base44 returned whole story records, author e-mail included).
// Body: { username }

const PROFILE_FIELDS =
  'id, username, full_name, display_name, headline, bio, location, skills, links, profile_image, is_private';
const POST_FIELDS =
  'id, author_id, title, status, cards, color_tokens, cover_image, tags, display_order, ai_generated, generation_style, created_at, updated_at';

export default {
  fetch: withSupabase({ auth: ['user', 'publishable'] }, async (req, ctx) => {
    try {
      if (isRateLimited(getClientIP(req))) {
        return Response.json({ status: 'rate_limited', user: null, posts: [] }, { status: 429 });
      }
      const body = await req.json().catch(() => ({}));
      const username = normalizeUsername(body?.username);
      if (!isAllowedUsername(username)) {
        return Response.json({ status: 'not_found', user: null, posts: [] }, { status: 200 });
      }

      const { data: profile, error } = await ctx.supabaseAdmin
        .from('profiles').select(PROFILE_FIELDS).eq('username', username).maybeSingle();
      if (error) throw error;
      if (!profile) {
        return Response.json({ status: 'not_found', user: null, posts: [] }, { status: 200 });
      }
      if (profile.is_private) {
        return Response.json(
          { status: 'private', user: { username: profile.username }, posts: [] },
          { status: 200 },
        );
      }

      // Only published stories, newest first (Base44: '-created_date', 50).
      const { data: posts, error: postsError } = await ctx.supabaseAdmin
        .from('posts').select(POST_FIELDS)
        .eq('author_id', profile.id).eq('status', 'published')
        .order('created_at', { ascending: false }).limit(50);
      if (postsError) throw postsError;

      const { is_private: _ignored, ...user } = profile;
      return Response.json({ status: 'public', user, posts: posts ?? [] }, { status: 200 });
    } catch (error) {
      // Anonymous endpoint: log the detail, never send it to the caller.
      console.log(`[getPublicProfile] error: ${(error as Error)?.message || error}`);
      return Response.json({ status: 'error', user: null, posts: [] }, { status: 500 });
    }
  }),
};
