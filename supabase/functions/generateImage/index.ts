import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { DRAFTS_BUCKET, draftPath, isOwnDraft, isPublicUrl, PUBLIC_BUCKET } from '../_shared/media.ts';
import { generateImageBytes, MODELS, OpenRouterError } from '../_shared/openrouter.ts';
import { hasPremium } from '../_shared/premium.ts';

// Generates a picture from a text prompt (AI Carousel Builder, admin Prompt
// Test page). Port of base44/functions/generateImage, now on OpenRouter.
// Premium only, checked here on the server. The picture is saved in the
// caller's public-media folder and its public URL returned, as before.
// Body: { prompt, referenceImage?, aspectRatio? }  →  { url }

const ASPECT_RATIOS = ['1:1', '4:5', '3:4', '9:16', '16:9', '4:3', '5:4'];
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};

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
      const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
      if (prompt.length > 2000) return Response.json({ error: 'Prompt too long' }, { status: 400 });
      // Cards are square, so square unless the caller asks otherwise.
      const aspectRatio = ASPECT_RATIOS.includes(body?.aspectRatio) ? body.aspectRatio : '1:1';

      // Optional reference picture (image-to-image): the caller's own draft
      // file (sent as a short-lived link) or a public URL.
      const ref = typeof body?.referenceImage === 'string' ? body.referenceImage.trim() : '';
      let referenceUrl: string | null = null;
      if (ref) {
        if (isOwnDraft(ref, userId)) {
          const { data } = await ctx.supabase.storage
            .from(DRAFTS_BUCKET).createSignedUrl(draftPath(ref)!, 600);
          referenceUrl = data?.signedUrl ?? null;
        } else if (isPublicUrl(ref)) {
          referenceUrl = ref;
        }
        if (!referenceUrl) return Response.json({ error: 'Invalid referenceImage' }, { status: 400 });
      }

      const model = MODELS.image();
      const image = await generateImageBytes({
        model, prompt, aspectRatio, referenceUrls: referenceUrl ? [referenceUrl] : [],
      });
      const ext = EXTENSIONS[image.mediaType];
      if (!ext) return Response.json({ error: 'Unsupported image format' }, { status: 502 });

      const path = `${userId}/generated/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await ctx.supabaseAdmin.storage
        .from(PUBLIC_BUCKET).upload(path, image.bytes, { contentType: image.mediaType });
      if (uploadError) throw uploadError;
      const url = ctx.supabaseAdmin.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;

      console.log(
        `[generateImage] model=${model} cost=$${image.cost?.toFixed(4) ?? '?'} duration=${Date.now() - started}ms`,
      );
      return Response.json({ url }, { status: 200 });
    } catch (error) {
      console.log(`[generateImage] error: ${(error as Error)?.message || error}`);
      const status = error instanceof OpenRouterError && error.status === 400 ? 400 : 500;
      return Response.json({ error: 'Image generation failed' }, { status });
    }
  }),
};
