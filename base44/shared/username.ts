// Username rules + ownership, shared by every backend function that reads or
// writes usernames. Mirrors src/lib/usernameValidation.js (client-side hints
// only — these server rules are the ones that count).
//
// Ownership: the built-in User entity always lets a user edit their own
// record (Base44 rule, can't be changed), so a username written straight to
// User proves nothing. The authoritative owner of a username is its
// UsernameClaim row, which only the server (service role) can write — via
// setUsername, or lazily for legacy accounts in claimUsernameIfUnclaimed.

export const RESERVED_USERNAMES = [
  'signin', 'login', 'signup', 'register', 'get-started', 'dashboard',
  'admin', 'settings', 'account', 'profile', 'explore', 'search', 'home',
  'api', 'app', 'www', 'support', 'help', 'about', 'terms', 'privacy',
  'blog', 'pricing', 'contact', 'storywall',
  'sitemap', 'robots', 'favicon', 'manifest', 'well-known'
];

export function normalizeUsername(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

export function isValidUsernameFormat(v: string): boolean {
  if (!v) return false;
  if (!/^[a-z0-9_-]+$/.test(v)) return false;
  if (v.length < 3 || v.length > 30) return false;
  if (/^-|-$/.test(v)) return false;
  return true;
}

export function isAllowedUsername(v: string): boolean {
  return isValidUsernameFormat(v) && !RESERVED_USERNAMES.includes(v);
}

// deno-lint-ignore no-explicit-any
type Base44 = any;

// The earliest claim wins if a race ever produced two.
export async function getUsernameClaim(base44: Base44, username: string) {
  const claims = await base44.asServiceRole.entities.UsernameClaim.filter({ username }, 'created_date', 1);
  return claims[0] || null;
}

// Read-only owner lookup, for anonymous callers (getPublicProfile): the
// claim's owner, or — for a legacy name with no claim yet — the oldest
// account holding it, which is exactly who claimUsernameIfUnclaimed would
// claim it for. Same answer, but no write: an unauthenticated request never
// creates records. Claims for legacy names are still created on the
// signed-in paths (setUsername, searchProfiles).
export async function resolveUsernameOwnerId(base44: Base44, username: string): Promise<string | null> {
  const claim = await getUsernameClaim(base44, username);
  if (claim) return claim.user_id;
  if (!isAllowedUsername(username)) return null;
  const users = await base44.asServiceRole.entities.User.filter({ username }, 'created_date', 1);
  return users[0]?.id || null;
}

// Legacy accounts (and sign-ups made before setUsername existed) have a
// username on their User record but no claim. The first time such a name is
// looked up, claim it for the oldest account holding it, so a later
// self-written duplicate can never take it over.
export async function claimUsernameIfUnclaimed(base44: Base44, username: string) {
  const existing = await getUsernameClaim(base44, username);
  if (existing) return existing;
  if (!isAllowedUsername(username)) return null;
  const users = await base44.asServiceRole.entities.User.filter({ username }, 'created_date', 1);
  const owner = users[0];
  if (!owner) return null;
  return await base44.asServiceRole.entities.UsernameClaim.create({ username, user_id: owner.id });
}
