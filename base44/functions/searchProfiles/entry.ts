import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { normalizeUsername, isAllowedUsername, claimUsernameIfUnclaimed } from '../../shared/username.ts';

// Public endpoint — searches public profiles by username, display_name, or full_name.
// Excludes private profiles. Returns only public fields. Case-insensitive partial match.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Require authentication — profile search is an authenticated feature.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim().toLowerCase() : "";
    if (!query) {
      return Response.json({ results: [] }, { status: 200 });
    }

    // Fetch users and filter server-side (partial match across multiple fields).
    // Service role is required to search across all users; only public fields
    // are returned and private profiles are excluded.
    const users = await base44.asServiceRole.entities.User.list("-created_date", 100);

    const matches = users.filter(u => {
      if (u.is_private) return false;
      if (!u.username) return false;
      const username = u.username.toLowerCase();
      const displayName = (u.display_name || '').toLowerCase();
      const fullName = (u.full_name || '').toLowerCase();
      return username.includes(query) || displayName.includes(query) || fullName.includes(query);
    });

    // Only list a user under a username they actually own (its claim — see
    // shared/username.ts), so a self-written name can't appear in results.
    const results = [];
    for (const u of matches) {
      if (results.length >= 10) break;
      const username = normalizeUsername(u.username);
      if (!isAllowedUsername(username)) continue;
      const claim = await claimUsernameIfUnclaimed(base44, username);
      if (!claim || claim.user_id !== u.id) continue;
      results.push({
        username: u.username,
        display_name: u.display_name || u.full_name,
        profile_image: u.profile_image,
        headline: u.headline,
      });
    }

    return Response.json({ results }, { status: 200 });
  } catch (error) {
    console.log(`[searchProfiles] error: ${error?.message || error}`);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}