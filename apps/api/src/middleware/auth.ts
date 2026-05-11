import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifySession } from "@gitvisor/auth";
import { config } from "../config.js";
import type { User } from "@gitvisor/shared";

export interface AuthEnv {
  Variables: {
    user: User;
    sessionToken: string;
  };
}

/**
 * Middleware that validates the signed session cookie locally.
 * No outbound HTTP call — payload is decoded and HMAC-verified in-process.
 * Returns 401 if the cookie is missing, tampered with, or expired.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, config.session.cookieName);

  if (!token) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const payload = verifySession(token, config.session.secret);
  if (!payload) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  const user: User = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.avatarUrl,
    createdAt: new Date(payload.exp * 1000 - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  c.set("user", user);
  c.set("sessionToken", token);
  return await next();
});
