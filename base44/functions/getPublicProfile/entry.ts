import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { isRateLimited, getClientIP } from '../../shared/rateLimit.ts';
import { normalizeUsername, isAllowedUsername, resolveUsernameOwnerId } from '../../shared/username.ts';

// ── INTENTIONAL: no authentication required ──────────────────────────────
// This function is intentionally callable without a logged-in user. It serves
// the public profile view — anyone with a profile link must be able to load it
// without signing in. Requiring authentication here would break public profile
// viewing. The missing-authentication scanner flag is expected and intentional
// — do NOT add a login requirement. Rate-limiting mitigates scraping instead.
// ─────────────────────────────────────────────────────────────────────────
//
// Public endpoint — uses the service role to read the User and published Posts.
// Returns a status field: "public", "private", or "not_found".
// Private profiles return only the username — no content is revealed.
export default async function(req) {
  try {
    // Per-IP rate limit — mitigates automated scraping of public profile data.
    const ip = getClientIP(req);
    if (isRateLimited(ip)) {
      return Response.json({ status: "rate_limited", user: null, posts: [] }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    // Reserved/invalid names are never served, even if some account wrote one
    // onto its own User record directly.
    if (!isAllowedUsername(username)) {
      return Response.json({ status: "not_found", user: null, posts: [] }, { status: 200 });
    }

    // Resolve the name through its server-written claim (shared/username.ts):
    // a username self-written to the User record can't hijack this page.
    // Read-only — this endpoint is anonymous, so it never writes (a legacy,
    // unclaimed name resolves to its oldest holder without creating a claim).
    const ownerId = await resolveUsernameOwnerId(base44, username);
    const user = ownerId
      ? await base44.asServiceRole.entities.User.get(ownerId).catch(() => null)
      : null;
    // The owner must still be using the name (a stale claim isn't served).
    if (!user || normalizeUsername(user.username) !== username) {
      return Response.json({ status: "not_found", user: null, posts: [] }, { status: 200 });
    }

    // Private profile — don't reveal content, just the username
    if (user.is_private) {
      return Response.json({
        status: "private",
        user: { username: user.username },
        posts: []
      }, { status: 200 });
    }

    // Public fields only — email and role are intentionally omitted.
    const publicUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      display_name: user.display_name,
      headline: user.headline,
      bio: user.bio,
      location: user.location,
      skills: user.skills,
      links: user.links,
      profile_image: user.profile_image,
    };

    // Only published stories; drafts stay private to the owner.
    const posts = await base44.asServiceRole.entities.Post.filter(
      { author_id: user.id, status: "published" },
      "-created_date",
      50
    );

    return Response.json({ status: "public", user: publicUser, posts }, { status: 200 });
  } catch (error) {
    // Log the detail server-side only: this endpoint is anonymous, so raw
    // exception text must never reach the caller.
    console.log(`[getPublicProfile] error: ${error?.message || error}`);
    return Response.json({ status: "error", user: null, posts: [] }, { status: 500 });
  }
}