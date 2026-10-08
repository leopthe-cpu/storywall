// Only http(s) URLs may go into an href. A user-controlled value like
// "javascript:…" or "data:…" would otherwise run script in the visitor's
// browser when clicked. Used by every place that links to a URL a user typed
// (profile links, social links).
export function isSafeHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}
