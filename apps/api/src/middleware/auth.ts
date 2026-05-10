import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { NubeAuthClient } from "@nube-auth/client";
import { config } from "../config.js";
import type { User } from "@gitvisor/shared";

export interface AuthEnv {
  Variables: {
    user: User;
    sessionToken: string;
  };
}

/**
 * Middleware that validates the session cookie via NubeAuth /v1/me.
 * Creates a per-request client scoped to the user's session token so that
 * the correct user identity is resolved even under concurrent requests.
 * Returns 401 if the session is missing or the token is invalid/expired.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, config.session.cookieName);

  if (!token) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    // Per-request client — carries the user's session token, not the app secret.
    const client = new NubeAuthClient({
      gatewayUrl: config.nubeAuth.gatewayUrl,
      appId: config.nubeAuth.appId,
      sessionToken: token,
    });
    const nubeUser = await client.me.get();
    const user: User = {
      id: nubeUser.id,
      email: nubeUser.email,
      name: nubeUser.name,
      avatarUrl: nubeUser.avatar_url ?? null,
      createdAt: nubeUser.createdAt,
    };
    c.set("user", user);
    c.set("sessionToken", token);
    await next();
  } catch {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }
});
