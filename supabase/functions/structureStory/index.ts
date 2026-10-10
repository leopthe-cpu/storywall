import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { DRAFTS_BUCKET, draftPath, isOwnDraft, isPublicUrl } from '../_shared/media.ts';
import { chatJson, MODELS } from '../_shared/openrouter.ts';
import { hasPremium, pickModel } from '../_shared/premium.ts';
import { type Attachment, runStructurePipeline } from './pipeline.ts';

// AI Carousel Builder, step 1: turns the user's notes into structured cards.
// Port of base44/functions/structureStory (same instructions, same checks),
// now on OpenRouter. Premium only, checked here on the server.
// Body: { text, attachments?: [{ url, type }], model? (admins only) }  →  { structured }

const MAX_TEXT = 20_000;
const MAX_ATTACHMENTS = 10;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const started = Date.now();
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (!(await hasPremium(ctx.supabaseAdmin, userId))) {
        return Response.json({ error: 'Premium required' }, { status: 403 });
      }

      const body = await req.json().catch(() => ({}));
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) return Response.json({ error: 'Text is required' }, { status: 400 });
      if (text.length > MAX_TEXT) return Response.json({ error: 'Text too long' }, { status: 400 });

      // The model may look at the user's own pictures: a private draft file is
      // passed as a short-lived signed link (signed as the caller, so storage
      // rules apply), a public URL as is. Anything else is listed by type only.
      const raw = Array.isArray(body?.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];
      const attachments: Attachment[] = [];
      for (const a of raw) {
        if (typeof a?.url !== 'string' || !a.url) continue;
        const type = typeof a.type === 'string' ? a.type : 'image';
        let imageUrl: string | null = null;
        if (type === 'image') {
          if (isOwnDraft(a.url, userId)) {
            const { data } = await ctx.supabase.storage
              .from(DRAFTS_BUCKET).createSignedUrl(draftPath(a.url)!, 600);
            imageUrl = data?.signedUrl ?? null;
          } else if (isPublicUrl(a.url)) {
            imageUrl = a.url;
          }
        }
        attachments.push({ type, imageUrl });
      }

      const model = await pickModel(ctx.supabaseAdmin, userId, body?.model, MODELS.structure());
      const { structured, attempts, cost } = await runStructurePipeline({
        text, attachments, model, chat: chatJson,
      });
      console.log(
        `[structureStory] model=${model} attempts=${attempts} cost=$${cost.toFixed(4)} ` +
          `cards=${structured?.cards?.length ?? 0} duration=${Date.now() - started}ms`,
      );
      if (!structured) return Response.json({ error: 'Failed to structure story' }, { status: 502 });
      return Response.json({ structured }, { status: 200 });
    } catch (error) {
      console.log(`[structureStory] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }),
};
