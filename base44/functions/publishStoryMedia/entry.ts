import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Copies private draft media (file_uris) to public storage at publish time so
// published stories' media is world-readable (as intended) while draft media
// never is. Verifies the caller owns the post (if editing) and every file_uri
// (via Media records) before copying. Returns the transformed cards with
// public file_urls replacing private file_uris.

const isPrivateUri = (v) => typeof v === 'string' && !!v && !/^https?:\/\//i.test(v);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const cards = Array.isArray(body?.cards) ? body.cards : [];
    const postId = typeof body?.postId === 'string' && body.postId ? body.postId : null;

    // If editing an existing post, verify the caller owns it.
    if (postId) {
      const posts = await base44.entities.Post.filter({ id: postId });
      const post = posts[0];
      if (!post) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      if (post.author_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Collect all private file_uris from media elements across all cards.
    const privateUris = new Set();
    for (const card of cards) {
      for (const el of (card?.elements || [])) {
        if (
          (el.type === 'image' || el.type === 'video' || el.type === 'audio') &&
          isPrivateUri(el.image_url)
        ) {
          privateUris.add(el.image_url);
        }
      }
    }

    // No private media (e.g. all-public existing media) — nothing to copy.
    if (privateUris.size === 0) {
      return Response.json({ cards }, { status: 200 });
    }

    // Ownership check: every file_uri must belong to a Media record owned by
    // the caller. Reject the entire publish if any are unowned.
    const mediaItems = await base44.asServiceRole.entities.Media.filter(
      { user_id: user.id },
      '-created_date',
      500
    );
    const owned = new Set(
      mediaItems.map((m) => m.image_url).filter(Boolean)
    );

    const unowned = [...privateUris].filter((u) => !owned.has(u));
    if (unowned.length) {
      return Response.json(
        { error: 'Forbidden: media not owned by caller', rejected: unowned },
        { status: 403 }
      );
    }

    // Copy each private file to public storage: signed URL → fetch bytes →
    // re-upload to public bucket.
    const uriToPublic = {};
    for (const uri of privateUris) {
      try {
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: uri,
          expires_in: 120,
        });
        const fileResp = await fetch(signed_url);
        if (!fileResp.ok) throw new Error(`fetch failed: ${fileResp.status}`);
        const blob = await fileResp.blob();
        const contentType = blob.type || 'application/octet-stream';
        const ext = contentType.startsWith('image/') ? 'img'
          : contentType.startsWith('video/') ? 'vid' : 'aud';
        const file = new File([blob], `publish-${ext}`, { type: contentType });
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
        uriToPublic[uri] = file_url;
      } catch (e) {
        return Response.json(
          { error: `Failed to publish media: ${e?.message || e}`, uri },
          { status: 500 }
        );
      }
    }

    // Replace private file_uris with public file_urls in the cards.
    const transformedCards = cards.map((card) => ({
      ...card,
      elements: (card.elements || []).map((el) => {
        if (
          (el.type === 'image' || el.type === 'video' || el.type === 'audio') &&
          uriToPublic[el.image_url]
        ) {
          return { ...el, image_url: uriToPublic[el.image_url] };
        }
        return el;
      }),
    }));

    return Response.json({ cards: transformedCards }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error?.message || 'failed' }, { status: 500 });
  }
}