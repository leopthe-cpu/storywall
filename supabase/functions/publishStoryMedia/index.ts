import { withSupabase } from 'npm:@supabase/server@1.9.1';
import {
  collectDraftRefs, draftPath, DRAFTS_BUCKET, isOwnDraft, PUBLIC_BUCKET, replaceRefs,
} from '../_shared/media.ts';

// At publish time, copies a story's private draft media to public storage so
// the published story can be seen by everyone, while drafts never are. Port
// of base44/functions/publishStoryMedia. Checks that the caller owns the
// story being edited (or is an admin) and that every draft file is in the
// caller's own folder, then returns the cards with public URLs in place of
// the draft references.
// Body: { cards, postId? }  →  { cards } | { error } (403 / 404 / 500)

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json().catch(() => ({}));
      const cards = Array.isArray(body?.cards) ? body.cards : [];
      const postId = typeof body?.postId === 'string' && body.postId ? body.postId : null;

      if (postId) {
        const { data: post, error } = await ctx.supabaseAdmin
          .from('posts').select('author_id').eq('id', postId).maybeSingle();
        if (error) throw error;
        if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
        if (post.author_id !== userId) {
          const { data: admin } = await ctx.supabaseAdmin
            .from('admins').select('user_id').eq('user_id', userId).maybeSingle();
          if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const refs = collectDraftRefs(cards);
      if (refs.length === 0) return Response.json({ cards }, { status: 200 });

      const unowned = refs.filter((r) => !isOwnDraft(r, userId));
      if (unowned.length) {
        return Response.json(
          { error: 'Forbidden: media not owned by caller', rejected: unowned },
          { status: 403 },
        );
      }

      const toPublic: Record<string, string> = {};
      for (const ref of refs) {
        const path = draftPath(ref)!;
        const { data: blob, error: downloadError } = await ctx.supabaseAdmin.storage
          .from(DRAFTS_BUCKET).download(path);
        if (downloadError || !blob) {
          return Response.json({ error: 'Failed to publish media', uri: ref }, { status: 500 });
        }
        const fileName = path.split('/').pop() || 'file';
        const target = `${userId}/published/${crypto.randomUUID()}-${fileName}`;
        const { error: uploadError } = await ctx.supabaseAdmin.storage
          .from(PUBLIC_BUCKET)
          .upload(target, blob, { contentType: blob.type || 'application/octet-stream' });
        if (uploadError) {
          return Response.json({ error: 'Failed to publish media', uri: ref }, { status: 500 });
        }
        toPublic[ref] = ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).getPublicUrl(target).data.publicUrl;
      }

      return Response.json({ cards: replaceRefs(cards, toPublic) }, { status: 200 });
    } catch (error) {
      console.log(`[publishStoryMedia] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'failed' }, { status: 500 });
    }
  }),
};
