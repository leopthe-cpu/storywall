import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { isRateLimited, getClientIP } from '../../shared/rateLimit.ts';
import { normalizeUsername, isAllowedUsername, getUsernameClaim } from '../../shared/username.ts';

// ── INTENTIONAL: no authentication required ──────────────────────────────
// This function is intentionally callable without a logged-in user. It is
// used by visitors checking username availability BEFORE they have an account
// (pre-signup flow). Requiring authentication here would break that feature.
// The missing-authentication scanner flag is expected and intentional — do
// NOT add a login requirement. Rate-limiting mitigates enumeration instead.
// ─────────────────────────────────────────────────────────────────────────
//
// Checks username availability using service-role access (bypasses User RLS).
// Validates format, reserved words, and database uniqueness (case-insensitive).
//
// Returns ONLY { available: boolean } — no reason, no user data, no
// distinguishing error messages. All failure cases (bad format, reserved,
// taken, server error) return the same response shape so the endpoint
// cannot be used to enumerate user records beyond the availability boolean
// itself, which is rate-limited per IP.
export default async function(req) {
  try {
    const ip = getClientIP(req);
    if (isRateLimited(ip)) {
      return Response.json({ available: false }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);

    // All pre-check failures return identical shape — no distinguishing info.
    if (!isAllowedUsername(username)) {
      return Response.json({ available: false }, { status: 200 });
    }

    // Always derive the excluded user ID from the authenticated session — never
    // trust a client-supplied excludeUserId, which could be used to make a taken
    // username appear available by passing another user's ID.
    let excludeUserId: string | null = null;
    try {
      const me = await base44.auth.me();
      excludeUserId = me?.id || null;
    } catch {
      // Not authenticated — no self-exclusion (user has no record yet).
    }

    // The claim is authoritative (see shared/username.ts). Names with no
    // claim yet may still be held by a legacy account, so check User too.
    // Read-only: this anonymous endpoint never creates claims.
    const claim = await getUsernameClaim(base44, username);
    let available: boolean;
    if (claim) {
      available = claim.user_id === excludeUserId;
    } else {
      const existing = await base44.asServiceRole.entities.User.filter({ username });
      available = !existing.some(u => u.id !== excludeUserId);
    }

    return Response.json({ available }, { status: 200 });
  } catch (error) {
    return Response.json({ available: false }, { status: 500 });
  }
}