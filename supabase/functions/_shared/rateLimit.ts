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
  // Supabase Edge Functions sit behind Cloudflare, which sets
  // cf-connecting-ip to the caller's address and rewrites x-forwarded-for
  // (a client-supplied value doesn't survive). Checked on staging,
  // 2026-10-16: x-forwarded-for was "<client>,<client>, <internal hop>", and
  // the last entry, used before, was an internal address that changed from
  // request to request, so the per-address limit never added up. Order:
  // cf-connecting-ip, then x-real-ip, then the first x-forwarded-for entry.
  const xff = req.headers.get('x-forwarded-for');
  const xffFirst = xff ? xff.split(',')[0]?.trim() : null;
  return req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() || xffFirst || 'unknown';
}

// Shared limit, counted in the database (public.consume_rate_limit), so it
// holds across all function instances; the in-memory limit above only sees
// one instance's requests. Returns true when the caller is over the limit.
// Requests without a known address are not counted (they would all share
// one counter and block each other). If the database can't be reached the
// request is allowed: these functions serve public walls, and being
// reachable matters more than an exact limit.
// deno-lint-ignore no-explicit-any
export async function isRateLimitedShared(admin: any, key: string, ip: string, limit: number, windowSeconds = 60): Promise<boolean> {
  if (!ip || ip === 'unknown') return false;
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_key: `${key}:${ip}`, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) {
    console.log(`[rateLimit] shared limit check failed: ${error.message}`);
    return false;
  }
  return data === false;
}
