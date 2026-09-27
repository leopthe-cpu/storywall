// Shared username validation — used by the homepage claim field and the sign-up page.
// Mirrors the backend checkUsername function's format + reserved-word rules.

export const RESERVED_USERNAMES = [
  'signin', 'login', 'signup', 'register', 'get-started', 'dashboard',
  'admin', 'settings', 'account', 'profile', 'explore', 'search', 'home',
  'api', 'app', 'www', 'support', 'help', 'about', 'terms', 'privacy',
  'blog', 'pricing', 'contact', 'storywall',
  'sitemap', 'robots', 'favicon', 'manifest', 'well-known'
];

// Returns null if valid, or an error reason string.
export function validateUsernameFormat(v) {
  if (!v) return 'Username is required';
  if (!/^[a-z0-9_-]+$/.test(v)) return 'Letters, numbers, - and _ only';
  if (v.length < 3) return 'At least 3 characters';
  if (v.length > 30) return 'Max 30 characters';
  if (/^-|-$/.test(v)) return "Can't start or end with a hyphen";
  return null;
}

export function isReservedUsername(v) {
  return RESERVED_USERNAMES.includes(v);
}