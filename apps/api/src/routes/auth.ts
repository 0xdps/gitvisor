import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import {
  buildGitHubOAuthUrl,
  exchangeGitHubCode,
  fetchGitHubUser,
  signSession,
  verifySession,
  SESSION_TTL_SECONDS,
  generateSessionId,
  type TokenStore,
} from "@gitvisor/auth";
import type { RegistryRepository } from "@gitvisor/db";
import { config } from "../config.js";

/** Simple fixed-window rate limiter keyed by an arbitrary string (e.g. IP). */
function makeRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, { count: number; resetAt: number }>();
  // Sweep expired entries every 10 minutes to prevent unbounded memory growth
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

const authCallbackLimiter = makeRateLimiter(10, 60_000);

export function createAuthRouter(registry: RegistryRepository, tokenStore: TokenStore) {
  const router = new Hono();

  /**
   * GET /auth/login
   * Generates an OAuth state parameter (CSRF protection), stores it in an
   * httpOnly cookie, and returns the GitHub OAuth authorization URL.
   */
  router.get("/login", (c) => {
    const state = randomBytes(16).toString("hex");
    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: config.session.secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 600, // 10 minutes — enough time to complete the OAuth flow
    });
    const url = buildGitHubOAuthUrl(
      config.github.clientId,
      config.github.oauthRedirectUri,
      state,
    );
    return c.json({ ok: true, data: { url } });
  });

  /**
   * POST /auth/callback
   * Verifies the OAuth state (CSRF check), exchanges the code for a token,
   * stores the token server-side, and issues a signed session cookie.
   * Body: { code: string; state: string }
   */
  router.post("/callback", async (c) => {
    // Rate-limit by IP to prevent brute-force code guessing
    const ip =
      c.req.header("x-real-ip") ??
      c.req.header("x-forwarded-for")?.split(",").pop()?.trim() ??
      "unknown";
    if (!authCallbackLimiter(ip)) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }

    const body = await c.req.json<{ code: string; state: string }>();

    if (!body.code || !body.state) {
      return c.json({ ok: false, error: "Missing code or state" }, 400);
    }

    // Verify OAuth state to prevent CSRF
    const stateCookie = getCookie(c, "oauth_state");
    if (!stateCookie || stateCookie !== body.state) {
      return c.json({ ok: false, error: "Invalid OAuth state" }, 400);
    }
    deleteCookie(c, "oauth_state", { path: "/" });

    const { accessToken } = await exchangeGitHubCode(
      body.code,
      config.github.clientId,
      config.github.clientSecret,
      config.github.oauthRedirectUri,
    );

    const user = await fetchGitHubUser(accessToken);

    // Persist / update the user in the registry on every login
    await registry.upsertUser({
      id: String(user.id),
      githubUsername: user.githubUsername,
      email: user.email ?? "",
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    });

    // Store the GitHub token server-side; never embed it in the session cookie
    const sessionId = generateSessionId();
    await tokenStore.set(sessionId, accessToken, SESSION_TTL_SECONDS);

    const token = signSession(
      {
        sessionId,
        userId: String(user.id),
        githubUsername: user.githubUsername,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      },
      config.session.secret,
    );

    setCookie(c, config.session.cookieName, token, {
      httpOnly: true,
      secure: config.session.secure,
      sameSite: "Strict",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return c.json({ ok: true, data: { userId: user.id } });
  });

  /**
   * GET /auth/me
   * Decodes the signed session cookie and returns the current user.
   * No outbound HTTP call — all data is stored in the signed payload.
   */
  router.get("/me", async (c) => {
    const token = getCookie(c, config.session.cookieName);
    if (!token) {
      return c.json({ ok: false, error: "Not authenticated" }, 401);
    }

    const payload = verifySession(token, config.session.secret);
    if (!payload) {
      return c.json({ ok: false, error: "Session expired or invalid" }, 401);
    }

    // Verify the server-side store still holds this session — handles post-logout cookie replay
    const activeToken = await tokenStore.get(payload.sessionId);
    if (!activeToken) {
      return c.json({ ok: false, error: "Session expired or invalid" }, 401);
    }

    return c.json({
      ok: true,
      data: {
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
      },
    });
  });

  /**
   * POST /auth/logout
   * Revokes the server-side token and clears the session cookie.
   */
  router.post("/logout", async (c) => {
    const token = getCookie(c, config.session.cookieName);
    if (token) {
      const payload = verifySession(token, config.session.secret);
      if (payload) {
        await tokenStore.del(payload.sessionId);
      }
    }
    deleteCookie(c, config.session.cookieName, { path: "/" });
    return c.json({ ok: true, data: null });
  });

  return router;
}
