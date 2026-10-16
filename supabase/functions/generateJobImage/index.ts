import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { cleanImagePrompt } from '../_shared/imagePrompt.ts';
import { PUBLIC_BUCKET } from '../_shared/media.ts';
import { generateImageBytes, MODELS } from '../_shared/openrouter.ts';
import { hasPremium } from '../_shared/premium.ts';

// Generate as a server job, step 3 (docs/performance-plan.md, part A).
// Makes ONE picture of a Generate job. startGeneration calls it once per
// picture, with the user's own sign-in, after writing the cards; each call
// has its own time limit, so pictures don't share the 150 s of one call.
// It answers at once and makes the picture in the background.
//
// Body: { jobId, index }  →  202 { ok: true }
//
// Safe to expose to users: it only makes a picture the server already listed
// as "pending" in the caller's own job, from the prompt stored there (users
// can't change it), and each picture can be claimed only once.

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};
const ASPECT_RATIOS: Record<string, string> = { square: '1:1', tall: '4:5', wide: '16:9' };

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Pictures this instance is still making. If it is shut down, they are
// marked failed so the app shows the retry button instead of waiting.
const running = new Map<string, () => Promise<void>>();
addEventListener('beforeunload', () => {
  for (const markFailed of running.values()) markFailed().catch(() => {});
});

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const admin = ctx.supabaseAdmin;
      if (!(await hasPremium(admin, userId))) {
        return Response.json({ error: 'Premium required' }, { status: 403 });
      }

      const body = await req.json().catch(() => ({}));
      const jobId = typeof body?.jobId === 'string' ? body.jobId : '';
      const index = Number.isInteger(body?.index) ? body.index : -1;
      if (!jobId || index < 0) return Response.json({ error: 'Invalid request' }, { status: 400 });

      const { data: job, error } = await admin.from('generation_jobs')
        .select('user_id, status, card_shape, pictures').eq('id', jobId).maybeSingle();
      if (error) throw error;
      if (!job || job.user_id !== userId) return Response.json({ error: 'Not found' }, { status: 404 });
      // deno-lint-ignore no-explicit-any
      const picture = (job.pictures || []).find((p: any) => p?.index === index);
      if (job.status !== 'pictures' || !picture) {
        return Response.json({ error: 'Nothing to do' }, { status: 409 });
      }

      // Claim it (pending → running), so a repeated call can't pay twice.
      const { data: claimed, error: claimError } = await admin.rpc('update_job_picture', {
        p_job: jobId, p_index: index, p_from: ['pending'],
        p_patch: { status: 'running', started_at: new Date().toISOString() },
      });
      if (claimError) throw claimError;
      if (claimed !== true) return Response.json({ error: 'Already started' }, { status: 409 });

      const key = `${jobId}:${index}`;
      // deno-lint-ignore no-explicit-any
      const finish = async (patch: Record<string, unknown>): Promise<any> =>
        await admin.rpc('update_job_picture', { p_job: jobId, p_index: index, p_from: ['running'], p_patch: patch });
      running.set(key, async () => {
        await finish({ status: 'failed', error: 'stopped' });
      });
      EdgeRuntime.waitUntil(
        makePicture({
          admin, userId, jobId, index, prompt: picture.prompt,
          aspectRatio: ASPECT_RATIOS[job.card_shape] || '1:1', finish,
        }).finally(() => running.delete(key)),
      );
      return Response.json({ ok: true }, { status: 202 });
    } catch (error) {
      console.log(`[generateJobImage] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }),
};

async function makePicture(opts: {
  // deno-lint-ignore no-explicit-any
  admin: any;
  userId: string;
  jobId: string;
  index: number;
  prompt: unknown;
  aspectRatio: string;
  // deno-lint-ignore no-explicit-any
  finish: (patch: Record<string, unknown>) => Promise<any>;
}) {
  const { admin, userId, jobId, index, aspectRatio, finish } = opts;
  const started = Date.now();
  try {
    // A prompt that still describes people after cleaning gets no picture;
    // the card becomes a text card ("skipped", not an error to retry).
    const prompt = cleanImagePrompt(opts.prompt);
    if (!prompt) {
      console.log(`[generateJobImage] job=${jobId} index=${index}: prompt refused (people), no picture`);
      await finish({ status: 'skipped' });
      return;
    }

    const model = MODELS.image();
    const image = await generateImageBytes({ model, prompt, aspectRatio });
    const ext = EXTENSIONS[image.mediaType];
    if (!ext) throw new Error(`Unsupported image format ${image.mediaType}`);

    // Same place and library entry as generateImage + registerMedia, so the
    // picture shows in the user's media library as before.
    const path = `${userId}/generated/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(PUBLIC_BUCKET).upload(path, image.bytes, { contentType: image.mediaType });
    if (uploadError) throw uploadError;
    const url = admin.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: mediaError } = await admin.from('media')
      .insert({ user_id: userId, url, media_type: 'image', duration: 0 });
    if (mediaError) console.log(`[generateJobImage] job=${jobId} index=${index}: media library save failed: ${mediaError.message}`);

    const { error } = await finish({ status: 'done', url });
    if (error) throw error;
    console.log(
      `[generateJobImage] job=${jobId} index=${index} model=${model} ` +
        `cost=$${image.cost?.toFixed(4) ?? '?'} duration=${Date.now() - started}ms`,
    );
  } catch (error) {
    console.log(`[generateJobImage] job=${jobId} index=${index} failed: ${(error as Error)?.message || error}`);
    await finish({ status: 'failed', error: 'picture failed' });
  }
}
