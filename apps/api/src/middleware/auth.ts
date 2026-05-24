import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createHash } from "node:crypto";
import {
  verifySession,
  deserializeToken,
  serializeToken,
  refreshGitHubToken,
  SESSION_TTL_SECONDS,
  type TokenStore,
} from "@gitvisor/auth";
import { config } from "../config.js";
import { createLogger } from "@gitvisor/logger";
import type { User } from "@gitvisor/shared";

const log = createLogger("auth-middleware");

export interface AuthEnv {
  Variables: {
    user: User;
    /** The user's GitHub OAuth token, retrieved from the server-side token store. */
    githubToken: string;
  };
}

/**
 * Factory that creates an auth middleware bound to a token store.
 * Validates the signed session cookie locally (no outbound HTTP call) and
 * verifies that the server-side token store still holds an active entry —
 * which handles explicit logout and process-restart revocation.
 * Returns 401 if the cookie is missing, tampered with, expired, or revoked.
 */
export function createRequireAuth(tokenStore: TokenStore) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const token = getCookie(c, config.session.cookieName);

    if (!token) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = verifySession(token, config.session.secret);
    if (!payload) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }

    // Verify the server-side store still has a valid entry.
    // Returns null if the token was explicitly revoked (logout) or the process
    // restarted (InMemoryTokenStore), forcing the user to re-authenticate.
    const rawToken = await tokenStore.get(payload.sessionId);
    const stored = deserializeToken(rawToken);
    if (!stored) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }

    // Soft User-Agent fingerprint check.
    // A mismatch is logged as a potential session hijack but does NOT invalidate
    // the session — browser auto-updates silently change the UA string and we
    // must not lock legitimate users out.
    if (payload.uaHash) {
      const currentUaHash = createHash("sha256")
        .update(c.req.header("user-agent") ?? "")
        .digest("hex")
        .slice(0, 16);
      if (currentUaHash !== payload.uaHash) {
        log.warn(
          { userId: payload.userId, sessionId: payload.sessionId },
          "Session UA fingerprint mismatch — possible session hijacking",
        );
      }
    }

    // Auto-refresh the access token if it has expired (or is within 5 minutes
    // of expiry).  Only possible when a refresh token was stored at login, which
    // requires "Expire user authorization tokens" to be enabled on the GitHub App.
    let accessToken = stored.accessToken;
    if (stored.refreshToken && stored.expiresAt && Date.now() > stored.expiresAt - 5 * 60_000) {
      try {
        const refreshed = await refreshGitHubToken(
          stored.refreshToken,
          config.github.clientId,
          config.github.clientSecret,
        );
        accessToken = refreshed.accessToken;
        const newTtl = refreshed.refreshTokenExpiresIn ?? SESSION_TTL_SECONDS;
        await tokenStore.set(
          payload.sessionId,
          serializeToken({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? stored.refreshToken,
            ...(refreshed.expiresIn !== undefined
              ? { expiresAt: Date.now() + refreshed.expiresIn * 1000 }
              : {}),
          }),
          newTtl,
        );
      } catch {
        // Refresh token invalid or expired — force re-authentication.
        return c.json({ ok: false, error: "Unauthorized" }, 401);
      }
    }

    const user: User = {
      id: payload.userId,
      githubUsername: payload.githubUsername ?? "",
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      createdAt: payload.createdAt,
    };
    c.set("user", user);
    c.set("githubToken", accessToken);
    return await next();
  });
}
