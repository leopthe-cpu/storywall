import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { isOwnDraft, isPublicUrl, MEDIA_TYPES } from '../_shared/media.ts';

// Adds an uploaded or generated file to the caller's media library (a media
// row). Port of base44/functions/registerMedia; media rows are written only
// here (users have no insert right on public.media).
// Ownership is now part of the file's path: a private file must be in the
// caller's own folder ("drafts/<user id>/..."), which storage rules already
// guarantee for uploads. Public URLs (AI-generated or template images) may be
// shared between accounts.
// Body: { image_url, media_type?, duration? }  →  { media }

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json().catch(() => ({}));
      const url = typeof body?.image_url === 'string' ? body.image_url.trim() : '';
      const mediaType = (MEDIA_TYPES as readonly string[]).includes(body?.media_type)
        ? body.media_type
        : 'image';
      const duration = Number.isFinite(body?.duration) && body.duration >= 0 ? body.duration : 0;

      if (!url || url.length > 2048) {
        return Response.json({ error: 'Invalid image_url' }, { status: 400 });
      }
      if (!isPublicUrl(url) && !isOwnDraft(url, userId)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Idempotent: registering your own file again returns the same row.
      const { data: existing, error: findError } = await ctx.supabaseAdmin
        .from('media').select('*').eq('user_id', userId).eq('url', url).maybeSingle();
      if (findError) throw findError;
      if (existing) return Response.json({ media: existing }, { status: 200 });

      const { data: media, error } = await ctx.supabaseAdmin
        .from('media').insert({ user_id: userId, url, media_type: mediaType, duration })
        .select('*').single();
      if (error) throw error;
      return Response.json({ media }, { status: 200 });
    } catch (error) {
      console.log(`[registerMedia] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'failed' }, { status: 500 });
    }
  }),
};
