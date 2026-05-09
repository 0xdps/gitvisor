import { Hono } from "hono";
import { nubeAuthClient, config } from "../config.js";
import { setCookie, deleteCookie } from "hono/cookie";

export const authRouter = new Hono();

/**
 * GET /auth/login?provider=github
 * Starts the PKCE OAuth flow. Returns { url, codeVerifier }.
 * Frontend stores codeVerifier in sessionStorage then redirects to url.
 */
authRouter.get("/login", async (c) => {
  const provider = c.req.query("provider") ?? "github";
  if (provider !== "github" && provider !== "google") {
    return c.json({ ok: false, error: "Invalid provider" }, 400);
  }

  const returnTo = new URL("/auth/callback", c.req.url).toString();
  const { url, codeVerifier } = await nubeAuthClient.app.buildOAuthUrl({ returnTo });

  return c.json({ ok: true, data: { url, codeVerifier } });
});

/**
 * POST /auth/callback
 * Exchanges the OAuth code for a session token and sets httpOnly cookie.
 * Body: { code: string, codeVerifier: string }
 */
authRouter.post("/callback", async (c) => {
  const body = await c.req.json<{ code: string; codeVerifier: string }>();

  if (!body.code || !body.codeVerifier) {
    return c.json({ ok: false, error: "Missing code or codeVerifier" }, 400);
  }

  const { sessionToken, userId } = await nubeAuthClient.app.exchangeCode(body.code, {
    codeVerifier: body.codeVerifier,
  });

  setCookie(c, config.session.cookieName, sessionToken, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return c.json({ ok: true, data: { userId } });
});

/**
 * POST /auth/logout
 * Invalidates the session on NubeAuth and clears the cookie.
 */
authRouter.post("/logout", async (c) => {
  await nubeAuthClient.auth.logout().catch(() => {
    // Best-effort — clear cookie regardless
  });

  deleteCookie(c, config.session.cookieName, { path: "/" });
  return c.json({ ok: true, data: null });
});
