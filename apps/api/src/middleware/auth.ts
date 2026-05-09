import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { nubeAuthClient } from "../config.js";
import type { User } from "@gitvisor/shared";

export interface AuthEnv {
  Variables: {
    user: User;
    sessionToken: string;
  };
}

/**
 * Middleware that validates the session cookie via NubeAuth /v1/me.
 * Attaches the user to context. Returns 401 if session is missing or invalid.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, "gitvisor_session");

  if (!token) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const nubeUser = await nubeAuthClient.me.get();
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
