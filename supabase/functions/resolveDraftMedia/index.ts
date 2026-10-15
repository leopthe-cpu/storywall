import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { DRAFTS_BUCKET, draftPath, isOwnDraft } from '../_shared/media.ts';

// Turns private draft file references into short-lived links the builder can
// show. Port of base44/functions/resolveDraftMedia. Only files in the
// caller's own folder are resolved; the rest are listed as rejected. Links
// are signed as the caller, so the storage rules apply too.
// Body: { file_uris: string[] }  →  { resolved: { [ref]: url }, rejected: string[] }

const SIGNED_URL_EXPIRY = 3600; // 1 hour, as in Base44

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const body = await req.json().catch(() => ({}));
      const refs: string[] = Array.isArray(body?.file_uris)
        ? body.file_uris.filter((u: unknown) => typeof u === 'string' && u)
        : [];

      const resolved: Record<string, string> = {};
      const rejected: string[] = [];
      for (const ref of refs) {
        if (!isOwnDraft(ref, userId)) {
          rejected.push(ref);
          continue;
        }
        const { data, error } = await ctx.supabase.storage
          .from(DRAFTS_BUCKET).createSignedUrl(draftPath(ref)!, SIGNED_URL_EXPIRY);
        if (error || !data?.signedUrl) rejected.push(ref);
        else resolved[ref] = data.signedUrl;
      }
      return Response.json({ resolved, rejected }, { status: 200 });
    } catch (error) {
      console.log(`[resolveDraftMedia] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'failed' }, { status: 500 });
    }
  }),
};
