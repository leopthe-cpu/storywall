import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Adds an uploaded or generated file to the caller's media library (a Media
// record). This is the ONLY way Media records are created — the entity's
// create/update RLS is admin-only, so a browser can't write one directly.
//
// Why: resolveDraftMedia and publishStoryMedia treat "the caller has a Media
// record with this file_uri" as proof the caller owns that private file. If
// clients could write Media rows themselves, anyone could register someone
// else's private file_uri and pass that check. Here the server decides who
// owns a private file: the first account to register it, immediately after
// its own upload. A private file_uri already registered to another account
// is refused.
//
// Public URLs (AI-generated images, template images) are world-readable
// anyway and are legitimately shared between accounts, so they skip the
// first-owner rule.
//
// Body: { image_url, media_type?: 'image'|'video'|'audio', duration?: number }
// Returns: { media }  (the caller's record, existing or new)

const MEDIA_TYPES = ['image', 'video', 'audio'];
const isPublicUrl = (v: string) => /^https?:\/\//i.test(v);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const imageUrl = typeof body?.image_url === 'string' ? body.image_url.trim() : '';
    const mediaType = MEDIA_TYPES.includes(body?.media_type) ? body.media_type : 'image';
    const duration = Number.isFinite(body?.duration) && body.duration >= 0 ? body.duration : 0;

    if (!imageUrl || imageUrl.length > 2048) {
      return Response.json({ error: 'Invalid image_url' }, { status: 400 });
    }
    // Private uploads always land under mp/private/ — anything else that isn't
    // a URL is not a file this app produced.
    if (!isPublicUrl(imageUrl) && !imageUrl.startsWith('mp/private/')) {
      return Response.json({ error: 'Invalid image_url' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Media.filter({ image_url: imageUrl });
    const mine = existing.find((m: { user_id?: string }) => m.user_id === user.id);
    if (mine) {
      // Idempotent: re-registering your own file is fine.
      return Response.json({ media: mine }, { status: 200 });
    }
    if (!isPublicUrl(imageUrl) && existing.length > 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const media = await base44.asServiceRole.entities.Media.create({
      image_url: imageUrl,
      user_id: user.id,
      media_type: mediaType,
      duration,
    });
    return Response.json({ media }, { status: 200 });
  } catch (error) {
    console.log(`[registerMedia] error: ${(error as Error)?.message || error}`);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}
