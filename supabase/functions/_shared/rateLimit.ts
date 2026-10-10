// Per-IP in-memory rate limiter: best effort, resets when a function instance
// restarts (same behaviour as Base44's base44/shared/rateLimit.ts). Used by
// the functions visitors can call without signing in, to slow down scraping
// and username enumeration.

const DEFAULT_WINDOW_MS = 60_000; // 60 seconds
const DEFAULT_MAX = 20; // requests per window per IP

const ipHits = new Map<string, number[]>();

export function isRateLimited(
  ip: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
  now: number = Date.now(),
): boolean {
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

export function getClientIP(req: Request): string {
  // Prefer x-real-ip (set by the platform). Otherwise use the LAST
  // x-forwarded-for entry (the nearest proxy hop); the first entry is
  // client-supplied and would let a caller dodge the limit.
  const xff = req.headers.get('x-forwarded-for');
  const xffLast = xff ? xff.split(',').pop()?.trim() : null;
  return req.headers.get('x-real-ip')?.trim() || xffLast || 'unknown';
}
