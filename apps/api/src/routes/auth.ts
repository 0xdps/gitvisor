import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import {
  buildGitHubOAuthUrl,
  exchangeGitHubCode,
  fetchGitHubUser,
  signSession,
  verifySession,
  SESSION_TTL_SECONDS,
} from "@gitvisor/auth";
import { config } from "../config.js";

export const authRouter = new Hono();

/**
 * GET /auth/login
 * Returns the GitHub OAuth authorization URL.
 * Frontend redirects the user to this URL.
 */
authRouter.get("/login", (c) => {
  const url = buildGitHubOAuthUrl(
    config.github.clientId,
    config.github.oauthRedirectUri,
  );
  return c.json({ ok: true, data: { url } });
});

/**
 * POST /auth/callback
 * Exchanges the GitHub OAuth code for an access token, fetches the user
 * profile, signs a local session cookie, and returns the user.
 * Body: { code: string }
 */
authRouter.post("/callback", async (c) => {
  const body = await c.req.json<{ code: string }>();

  if (!body.code) {
    return c.json({ ok: false, error: "Missing code" }, 400);
  }

  const { accessToken } = await exchangeGitHubCode(
    body.code,
    config.github.clientId,
    config.github.clientSecret,
    config.github.oauthRedirectUri,
  );

  const user = await fetchGitHubUser(accessToken);

  const token = signSession(
    {
      userId: String(user.id),
      githubUsername: user.githubUsername,
      githubToken: accessToken,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    config.session.secret,
  );

  setCookie(c, config.session.cookieName, token, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: "Lax",
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
authRouter.get("/me", (c) => {
  const token = getCookie(c, config.session.cookieName);
  if (!token) {
    return c.json({ ok: false, error: "Not authenticated" }, 401);
  }

  const payload = verifySession(token, config.session.secret);
  if (!payload) {
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
 * Clears the session cookie. No outbound call needed.
 */
authRouter.post("/logout", (c) => {
  deleteCookie(c, config.session.cookieName, { path: "/" });
  return c.json({ ok: true, data: null });
});
