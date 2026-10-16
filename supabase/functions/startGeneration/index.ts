import { withSupabase } from 'npm:@supabase/server@1.9.1';
import { DRAFTS_BUCKET, draftPath, isOwnDraft, isPublicUrl } from '../_shared/media.ts';
import { chatJson, MODELS } from '../_shared/openrouter.ts';
import { hasPremium } from '../_shared/premium.ts';
import { type Attachment, runStructurePipeline } from '../structureStory/pipeline.ts';

// Generate as a server job, step 2 (docs/performance-plan.md, part A).
// Starts a Generate run and answers straight away with the job id; the cards
// are written in the background (EdgeRuntime.waitUntil), so closing the tab
// no longer loses the result. The browser watches the generation_jobs row.
// Pictures are a separate step (one call per picture, each with its own time
// limit), so this function only lists the pictures the story needs.
//
// Body: { text, attachments?: [{ url, type }], postId? }  →  { jobId, postId }
// postId: the user's own draft to put the result in; a new draft otherwise.

const MAX_TEXT = 20_000;
const MAX_ATTACHMENTS = 10;
// Same rule as the browser pipeline (src/lib/generatePipeline.js): at most 3
// AI pictures per story, the first ones win so the cover keeps its picture.
const MAX_GENERATED_IMAGES = 3;
// Generate runs per user per UTC day (each one is a paid AI call, plus up to
// 3 pictures). Counted in the database, where users can't reset it.
const DAILY_GENERATE_LIMIT = 20;
// A run that is still going after this long is treated as dead, so it
// doesn't block the user from starting another.
const STALE_AFTER_MS = 10 * 60 * 1000;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Jobs this instance is still writing. If the instance is shut down (time
// limit, crash), they are marked failed so the app can say so instead of
// waiting forever. Best effort: the 10-minute rule above is the backstop.
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
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) return Response.json({ error: 'Text is required' }, { status: 400 });
      if (text.length > MAX_TEXT) return Response.json({ error: 'Text too long' }, { status: 400 });

      // One run at a time per user: a second tap (or a script) can't start
      // several paid runs in parallel.
      const { data: active, error: activeError } = await admin.from('generation_jobs')
        .select('id').eq('user_id', userId).in('status', ['queued', 'writing', 'pictures'])
        .gt('created_at', new Date(Date.now() - STALE_AFTER_MS).toISOString()).limit(1);
      if (activeError) throw activeError;
      if (active?.length) {
        return Response.json({ error: 'A story is already being generated', jobId: active[0].id }, { status: 409 });
      }

      const { data: withinLimit, error: quotaError } = await admin.rpc('consume_ai_quota', {
        p_user: userId, p_kind: 'generate', p_limit: DAILY_GENERATE_LIMIT,
      });
      if (quotaError) throw quotaError;
      if (withinLimit !== true) return Response.json({ error: 'Daily limit reached' }, { status: 429 });

      // Attachments: kept as given for the browser (it places them on their
      // cards), and passed to the model as pictures it can look at. A private
      // draft file goes as a short-lived signed link, signed as the caller so
      // storage rules apply (same as structureStory).
      const raw = Array.isArray(body?.attachments) ? body.attachments.slice(0, MAX_ATTACHMENTS) : [];
      const kept: { url: string; type: string }[] = [];
      const forModel: Attachment[] = [];
      for (const a of raw) {
        if (typeof a?.url !== 'string' || !a.url) continue;
        const type = typeof a.type === 'string' ? a.type : 'image';
        if (!isOwnDraft(a.url, userId) && !isPublicUrl(a.url)) continue;
        let imageUrl: string | null = null;
        if (type === 'image') {
          if (isOwnDraft(a.url, userId)) {
            const { data } = await ctx.supabase.storage
              .from(DRAFTS_BUCKET).createSignedUrl(draftPath(a.url)!, 600);
            imageUrl = data?.signedUrl ?? null;
          } else {
            imageUrl = a.url;
          }
        }
        kept.push({ url: a.url, type });
        forModel.push({ type, imageUrl });
      }

      // The draft the result lands in: the caller's own draft, or a new one.
      let postId: string | null = typeof body?.postId === 'string' ? body.postId : null;
      if (postId) {
        const { data: post, error } = await admin.from('posts')
          .select('author_id, status').eq('id', postId).maybeSingle();
        if (error) throw error;
        if (!post || post.author_id !== userId || post.status !== 'draft') {
          return Response.json({ error: 'Invalid postId' }, { status: 400 });
        }
      } else {
        const { data: post, error } = await admin.from('posts')
          .insert({ author_id: userId, title: '', status: 'draft', ai_generated: true })
          .select('id').single();
        if (error) throw error;
        postId = post.id;
      }
      const { error: notesError } = await admin.from('post_notes')
        .upsert({ post_id: postId, raw_notes: text }, { onConflict: 'post_id' });
      if (notesError) throw notesError;

      const { data: job, error: jobError } = await admin.from('generation_jobs')
        .insert({ user_id: userId, post_id: postId, status: 'writing', options: { attachments: kept } })
        .select('id').single();
      if (jobError) throw jobError;

      const markFailed = async () => {
        await admin.from('generation_jobs')
          .update({ status: 'failed', error: 'stopped', finished_at: new Date().toISOString() })
          .eq('id', job.id).eq('status', 'writing');
      };
      running.set(job.id, markFailed);
      EdgeRuntime.waitUntil(
        writeCards(admin, job.id, text, forModel).finally(() => running.delete(job.id)),
      );

      return Response.json({ jobId: job.id, postId }, { status: 200 });
    } catch (error) {
      console.log(`[startGeneration] error: ${(error as Error)?.message || error}`);
      return Response.json({ error: 'Internal error' }, { status: 500 });
    }
  }),
};

// Writes the cards (the same structuring as structureStory) and saves them
// into the job. The layout is done in the browser, so only the text and
// picture prompts are stored.
// deno-lint-ignore no-explicit-any
async function writeCards(admin: any, jobId: string, text: string, attachments: Attachment[]) {
  const started = Date.now();
  try {
    const model = MODELS.structure();
    const { structured, attempts, cost } = await runStructurePipeline({
      text, attachments, model, chat: chatJson,
    });
    console.log(
      `[startGeneration] job=${jobId} model=${model} attempts=${attempts} cost=$${cost.toFixed(4)} ` +
        `cards=${structured?.cards?.length ?? 0} duration=${Date.now() - started}ms`,
    );
    if (!structured) throw new Error('Failed to structure story');

    // The AI pictures this story needs: cards that want one and don't get
    // one of the user's attached pictures, at most MAX_GENERATED_IMAGES.
    const attached = (card: Record<string, unknown>) =>
      typeof card.attachmentIndex === 'number' && card.attachmentIndex >= 0 &&
      card.attachmentIndex < attachments.length;
    const pictures = structured.cards
      .map((c, index) => ({ index, card: c }))
      .filter(({ card }) => card.needsImage && !attached(card))
      .slice(0, MAX_GENERATED_IMAGES)
      .map(({ index, card }) => ({
        index,
        status: 'pending',
        prompt: typeof card.imagePrompt === 'string' ? card.imagePrompt : null,
      }));

    const { error } = await admin.from('generation_jobs').update({
      status: pictures.length ? 'pictures' : 'done',
      result: structured,
      pictures,
      ...(pictures.length ? {} : { finished_at: new Date().toISOString() }),
    }).eq('id', jobId);
    if (error) throw error;
  } catch (error) {
    console.log(`[startGeneration] job=${jobId} failed: ${(error as Error)?.message || error}`);
    await admin.from('generation_jobs')
      .update({ status: 'failed', error: 'writing failed', finished_at: new Date().toISOString() })
      .eq('id', jobId);
  }
}
