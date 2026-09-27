import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Resolves private draft file_uris to short-lived signed URLs for rendering in
// the creator. Verifies ownership server-side: each requested file_uri must
// belong to a Media record owned by the authenticated caller. Unowned uris
// are rejected (not silently skipped). Returns { resolved, rejected }.

const SIGNED_URL_EXPIRY = 3600; // 1 hour

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fileUris = Array.isArray(body?.file_uris)
      ? body.file_uris.filter((u) => typeof u === 'string' && u)
      : [];
    if (!fileUris.length) {
      return Response.json({ resolved: {}, rejected: [] }, { status: 200 });
    }

    // Ownership: every upload creates a Media record with image_url = file_uri
    // and user_id = caller.id. Fetch the caller's media and build an owned set.
    // Service role is required: Media's read RLS is {} which does not expose
    // records to the user-scoped client. We filter to the caller's records only
    // and use the result solely for ownership verification.
    const mediaItems = await base44.asServiceRole.entities.Media.filter(
      { user_id: user.id },
      '-created_date',
      500
    );
    const owned = new Set(
      mediaItems.map((m) => m.image_url).filter(Boolean)
    );

    const resolved = {};
    const rejected = [];
    for (const uri of fileUris) {
      if (!owned.has(uri)) {
        rejected.push(uri);
        continue;
      }
      try {
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: uri,
          expires_in: SIGNED_URL_EXPIRY,
        });
        resolved[uri] = signed_url;
      } catch (e) {
        rejected.push(uri);
      }
    }

    return Response.json({ resolved, rejected }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error?.message || 'failed' }, { status: 500 });
  }
}