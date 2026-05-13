import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifySession, type TokenStore } from "@gitvisor/auth";
import { config } from "../config.js";
import type { User } from "@gitvisor/shared";

export interface AuthEnv {
  Variables: {
    user: User;
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
    const githubToken = await tokenStore.get(payload.sessionId);
    if (!githubToken) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
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
    return await next();
  });
}
