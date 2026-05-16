/**
 * Fixed-window rate limiter factory.
 *
 * makeIpRateLimiter   — keyed by remote IP; for public / pre-auth endpoints.
 * makeUserRateLimiter — keyed by userId; for authenticated endpoints that hit
 *                       the job queue or the GitHub API.
 */

function createLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, { count: number; resetAt: number }>();
  // Sweep expired entries every 10 minutes to prevent unbounded memory growth.
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 600_000);
  if (typeof interval === "object" && "unref" in interval) interval.unref();

  return (key: string): boolean => {
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
  };
}

/** IP-keyed rate limiter. Suitable for unauthenticated / pre-auth routes. */
export function makeIpRateLimiter(maxRequests: number, windowMs: number) {
  return createLimiter(maxRequests, windowMs);
}

/** userId-keyed rate limiter. Use on authenticated routes that enqueue jobs or call GitHub. */
export function makeUserRateLimiter(maxRequests: number, windowMs: number) {
  return createLimiter(maxRequests, windowMs);
}

/** Extract the best-effort client IP from Hono request headers. */
export function getClientIp(req: { header: (name: string) => string | undefined }): string {
  return (
    req.header("x-real-ip") ??
    req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
