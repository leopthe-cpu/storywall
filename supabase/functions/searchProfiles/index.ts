import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { isAllowedUsername, normalizeUsername } from '../_shared/username.ts';

// Profile search on the "This profile is private" page. Port of
// base44/functions/searchProfiles. Signed-in users only. Case-insensitive
// partial match on username, display name or full name, among the 100 most
// recent public profiles (as in Base44); at most 10 results with public
// fields only. Runs as the caller, so the profiles rules already hide
// private profiles.
// Body: { query }  →  { results: [{ username, display_name, profile_image, headline }] }

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const body = await req.json().catch(() => ({}));
      const query = typeof body?.query === 'string' ? body.query.trim().toLowerCase() : '';
      if (!query) return Response.json({ results: [] }, { status: 200 });

      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('username, display_name, full_name, profile_image, headline, is_private')
        .eq('is_private', false).not('username', 'is', null)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;

      const results = [];
      for (const p of data ?? []) {
        if (results.length >= 10) break;
        const username = normalizeUsername(p.username);
        if (!isAllowedUsername(username)) continue;
        const hit = [p.username, p.display_name, p.full_name]
          .some((v) => (v || '').toLowerCase().includes(query));
        if (!hit) continue;
        results.push({
          username: p.username,
          display_name: p.display_name || p.full_name,
          profile_image: p.profile_image,
          headline: p.headline,
        });
      }
      return Response.json({ results }, { status: 200 });
    } catch (error) {
      console.log(`[searchProfiles] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'failed' }, { status: 500 });
    }
  }),
};
