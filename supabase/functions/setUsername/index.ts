import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { isAllowedUsername, normalizeUsername } from '../_shared/username.ts';

// Sets the caller's username. Port of base44/functions/setUsername.
// Enforces format and reserved words here; uniqueness is enforced by the
// database (unique index), so a race between two sign-ups can't produce a
// duplicate. Users can't write profiles.username themselves (no column
// grant), so this is the only way a name is set.
// Body: { username }  →  { username } | { error } (400 / 409)

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json().catch(() => ({}));
      const username = normalizeUsername(body?.username);
      if (!isAllowedUsername(username)) {
        return Response.json({ error: 'That username isn’t allowed.' }, { status: 400 });
      }

      const { data: holder, error: lookupError } = await ctx.supabaseAdmin
        .from('profiles').select('id').eq('username', username).maybeSingle();
      if (lookupError) throw lookupError;
      if (holder && holder.id !== userId) {
        return Response.json({ error: 'That username is taken.' }, { status: 409 });
      }

      const { error } = await ctx.supabaseAdmin
        .from('profiles').update({ username }).eq('id', userId);
      if (error) {
        if (error.code === '23505') {
          return Response.json({ error: 'That username is taken.' }, { status: 409 });
        }
        throw error;
      }
      return Response.json({ username }, { status: 200 });
    } catch (error) {
      console.log(`[setUsername] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  }),
};
