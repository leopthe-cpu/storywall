import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { getClientIP, isRateLimited } from '../_shared/rateLimit.ts';
import { isAllowedUsername, normalizeUsername } from '../_shared/username.ts';

// Is a username free? Port of base44/functions/checkUsername.
// Callable without signing in (visitors check a name before signing up), so
// it's rate-limited per IP and answers only { available } — the same shape
// for bad format, reserved, taken and errors, so it can't be used to learn
// anything about accounts beyond that one yes/no. A signed-in caller's own
// current name counts as available to them.
// Body: { username }  →  { available: boolean }

export default {
  fetch: withSupabase({ auth: ['user', 'publishable'] }, async (req, ctx) => {
    try {
      if (isRateLimited(getClientIP(req))) {
        return Response.json({ available: false }, { status: 429 });
      }
      const body = await req.json().catch(() => ({}));
      const username = normalizeUsername(body?.username);
      if (!isAllowedUsername(username)) {
        return Response.json({ available: false }, { status: 200 });
      }
      const me = ctx.authMode === 'user' ? ctx.userClaims?.id ?? null : null;
      const { data, error } = await ctx.supabaseAdmin
        .from('profiles').select('id').eq('username', username).maybeSingle();
      if (error) throw error;
      return Response.json({ available: !data || data.id === me }, { status: 200 });
    } catch (error) {
      console.log(`[checkUsername] error: ${(error as Error)?.message || error}`);
      return Response.json({ available: false }, { status: 500 });
    }
  }),
};
