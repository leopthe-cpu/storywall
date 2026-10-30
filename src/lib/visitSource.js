// Where this visit came from, for traffic sources (decision 53). Links
// copied from Storywall carry ?via= with a tag from a fixed list; without
// one, the domain of the site the visitor came from (document.referrer,
// e.g. linkedin.com); otherwise "direct". Read once per page load and kept
// for that visit only (never stored in the browser); the tag is then
// removed from the address bar so it isn't copied on with the link.

export const VIA_TAGS = ['li', 'ig', 'x', 'email', 'link'];

let source = null;

function fromReferrer() {
  try {
    if (!document.referrer) return 'direct';
    const ref = new URL(document.referrer);
    // A reload, or a page of Storywall itself: not a new source.
    if (ref.host === window.location.host) return 'direct';
    return ref.hostname.toLowerCase().replace(/^www\./, '') || 'direct';
  } catch {
    return 'direct';
  }
}

// Reads the source of this visit (first call only) and returns the address
// without ?via= (or null when there was no tag to remove).
export function captureVisitSource(search = window.location.search) {
  const params = new URLSearchParams(search);
  const via = (params.get('via') || '').toLowerCase();
  if (source == null) source = VIA_TAGS.includes(via) ? via : fromReferrer();
  if (!params.has('via')) return null;
  params.delete('via');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export function visitSource() {
  if (source == null) source = fromReferrer();
  return source;
}

// A link to share, tagged so its visits count as `via` (default "link").
export function withVia(url, via = 'link') {
  const u = new URL(url);
  u.searchParams.set('via', via);
  return u.toString();
}
