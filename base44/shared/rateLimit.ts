// Per-IP in-memory rate limiter — best-effort, resets on cold start.
// Shared by public backend functions to mitigate automated scraping/enumeration.
//
// Usage:
//   const ip = getClientIP(req);
//   if (isRateLimited(ip)) return Response.json({ ... }, { status: 429 });

const DEFAULT_WINDOW_MS = 60_000; // 60 seconds
const DEFAULT_MAX = 20; // 20 requests per window per IP

const ipHits = new Map<string, number[]>();

export function isRateLimited(
  ip: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

export function getClientIP(req: Request): string {
  // Prefer x-real-ip (set by the platform/edge, not client-controllable).
  // If unavailable, use the LAST entry in x-forwarded-for — that's the
  // closest trusted proxy hop, not the client-supplied first entry which
  // is spoofable and would allow rate-limit bypass.
  const xff = req.headers.get("x-forwarded-for");
  const xffLast = xff ? xff.split(",").pop()?.trim() : null;
  return req.headers.get("x-real-ip")?.trim()
    || xffLast
    || "unknown";
}