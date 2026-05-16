import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";

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

/**
 * Redis-backed token store for multi-instance or persistent deployments.
 *
 * Tokens survive process restarts and are shared across all replicas behind
 * a load balancer — required for HA / multi-replica cloud deployments.
 *
 * Pass an ioredis `Redis` or `Cluster` client as `client`.
 */
export class RedisTokenStore implements TokenStore {
  private readonly client: Redis;
  private readonly prefix: string;

  constructor(client: Redis, prefix = "gitvisor::session:") {
    this.client = client;
    this.prefix = prefix;
  }

  async set(sessionId: string, token: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`${this.prefix}${sessionId}`, token, "EX", ttlSeconds);
  }

  async get(sessionId: string): Promise<string | null> {
    return this.client.get(`${this.prefix}${sessionId}`);
  }

  async del(sessionId: string): Promise<void> {
    await this.client.del(`${this.prefix}${sessionId}`);
  }
}

/** Generates a cryptographically random, opaque session ID. */
export function generateSessionId(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Stored-token serialization helpers
// ---------------------------------------------------------------------------

/**
 * The shape of data persisted in the token store for each session.
 * Serialized as JSON so both the access token and optional refresh token
 * can be stored under a single key.
 */
export interface StoredToken {
  accessToken: string;
  /** Present when the GitHub App has "Expire user authorization tokens" on. */
  refreshToken?: string;
  /** Unix timestamp (ms) when the access token expires, if known. */
  expiresAt?: number;
}

/** Serialize a StoredToken to the string format expected by TokenStore.set(). */
export function serializeToken(token: StoredToken): string {
  return JSON.stringify(token);
}

/**
 * Deserialize a raw token-store value back to StoredToken.
 * Handles both the new JSON format and the legacy plain-string format
 * (tokens stored before refresh-token support was added).
 * Returns null if the value is falsy or cannot be parsed.
 */
export function deserializeToken(raw: string | null): StoredToken | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "accessToken" in parsed &&
      typeof (parsed as { accessToken: unknown }).accessToken === "string"
    ) {
      return parsed as StoredToken;
    }
  } catch {
    // Legacy: plain token string stored before JSON serialization was introduced.
    return { accessToken: raw };
  }
  return null;
}
