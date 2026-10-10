// Username rules, shared by every function that reads or writes usernames.
// Same rules as src/lib/usernameValidation.js (which only gives hints in the
// browser; these are the ones that count). Uniqueness is enforced by the
// database (unique index on profiles.username).

export const RESERVED_USERNAMES = [
  'signin', 'login', 'signup', 'register', 'get-started', 'dashboard',
  'admin', 'settings', 'account', 'profile', 'explore', 'search', 'home',
  'api', 'app', 'www', 'support', 'help', 'about', 'terms', 'privacy',
  'blog', 'pricing', 'contact', 'storywall',
  'sitemap', 'robots', 'favicon', 'manifest', 'well-known',
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
