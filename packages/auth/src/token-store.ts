import { randomUUID } from "node:crypto";

/**
 * Minimal interface for server-side token storage.
 * Keeps GitHub access tokens out of the signed session cookie so that
 * tokens cannot be extracted from a stolen or replayed cookie.
 *
 * The default InMemoryTokenStore is suitable for single-instance deployments.
 * For multi-instance setups, swap in a Redis-backed implementation.
 */
export interface TokenStore {
  set(sessionId: string, token: string, ttlSeconds: number): Promise<void>;
  get(sessionId: string): Promise<string | null>;
  del(sessionId: string): Promise<void>;
}

/**
 * In-memory token store with TTL-based expiry.
 *
 * Tokens are lost on process restart — users will need to re-authenticate.
 * This is the correct security behaviour: a restart invalidates all sessions,
 * preventing use of tokens that may have been revoked upstream.
 *
 * Acceptable for single-instance self-hosted deployments and single-container
 * SaaS setups (Docker Compose). For HA / multi-replica, use a shared Redis store.
 */
export class InMemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, { token: string; exp: number }>();

  constructor(cleanupIntervalMs = 300_000) {
    // Purge expired entries every 5 minutes to prevent unbounded memory growth.
    // .unref() so the interval does not prevent the process from exiting.
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now > entry.exp) this.store.delete(key);
      }
    }, cleanupIntervalMs);
    if (typeof interval === "object" && "unref" in interval) interval.unref();
  }

  async set(sessionId: string, token: string, ttlSeconds: number): Promise<void> {
    this.store.set(sessionId, { token, exp: Date.now() + ttlSeconds * 1000 });
  }

  async get(sessionId: string): Promise<string | null> {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.token;
  }

  async del(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}

/** Generates a cryptographically random, opaque session ID. */
export function generateSessionId(): string {
  return randomUUID();
}
