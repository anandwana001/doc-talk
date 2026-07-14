// Sliding-window in-process rate limiter.
// Works correctly for single-process deployments (traditional Node.js, Docker).
// For multi-instance / serverless: replace the Map with a shared store
// such as Upstash Redis so the limit is enforced across all replicas.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune expired entries every 5 minutes so the Map stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) {
    if (e.resetAt <= now) store.delete(k);
  }
}, 5 * 60 * 1_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, entry);
  }
  entry.count++;
  return {
    allowed: entry.count <= opts.limit,
    remaining: Math.max(0, opts.limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/** Extract the best available client IP from the request headers. */
export function clientIp(request: Request): string {
  const fwd = (request as { headers: Headers }).headers.get('x-forwarded-for');
  return fwd?.split(',')[0].trim() ?? 'unknown';
}
