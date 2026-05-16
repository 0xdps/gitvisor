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
  serializeToken,
  deserializeToken,
  type TokenStore,
} from "@gitvisor/auth";
import type { RegistryRepository } from "@gitvisor/db";
import { config } from "../config.js";
import { makeIpRateLimiter, getClientIp } from "../middleware/rate-limit.js";

const authCallbackLimiter = makeIpRateLimiter(10, 60_000);

/**
 * Called after the user has been upserted in the registry but before the
 * session cookie is issued.  Cloud uses this to run NubeAuth provisioning,
 * installation sync, and per-user DB pre-migration.
 */
export interface AuthSuccessContext {
  userId: string;
  githubToken: string;
  githubUsername: string;
  /**
   * Set when login was initiated via the unified GitHub App installation flow
   * (github.com/apps/{slug}/installations/new).  The user selected and
   * installed the app on this account/org as part of signing in.
   * Cloud uses this to immediately enqueue a repo-sync job for the new
   * installation rather than waiting for the webhook to arrive.
   */
  installationId?: number;
}

export function createAuthRouter(
  registry: RegistryRepository,
  tokenStore: TokenStore,
  onAuthSuccess?: (ctx: AuthSuccessContext) => Promise<void>,
) {
  const router = new Hono();

  /**
   * GET /auth/login
   * Generates a CSRF state token, stores it in an httpOnly cookie, and returns
  * the GitHub OAuth authorization URL.
  *
  * Login always starts with plain OAuth. After the callback the API decides
  * whether to send the user to the dashboard directly or to the GitHub App
  * installation screen for first-time setup.
   */
  router.get("/login", (c) => {
    const state = randomBytes(16).toString("hex");
    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: config.session.secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 600, // 10 minutes — enough time to complete the flow
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
  * stores the token server-side, issues a signed session cookie, and returns
  * the next location the client should open.
   *
   * Body: { code: string; state: string; installation_id?: number }
   *
  * `installation_id` is present when the user arrived from a GitHub App
  * installation redirect. It is forwarded to onAuthSuccess so cloud/extensions
  * can immediately kick off a repo sync for that installation.
   */
  router.post("/callback", async (c) => {
    // Rate-limit by IP to prevent brute-force code guessing
    const ip = getClientIp(c.req);
    if (!authCallbackLimiter(ip)) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }

    const body = await c.req.json<{ code: string; state: string; installation_id?: number }>();

    if (!body.code || !body.state) {
      return c.json({ ok: false, error: "Missing code or state" }, 400);
    }

    // Verify OAuth state to prevent CSRF
    const stateCookie = getCookie(c, "oauth_state");
    if (!stateCookie || stateCookie !== body.state) {
      return c.json({ ok: false, error: "Invalid OAuth state" }, 400);
    }
    deleteCookie(c, "oauth_state", { path: "/" });

    const tokenResponse = await exchangeGitHubCode(
      body.code,
      config.github.clientId,
      config.github.clientSecret,
      config.github.oauthRedirectUri,
    );
    const { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn } = tokenResponse;

    const user = await fetchGitHubUser(accessToken);
    const appId = Number(config.github.appId);

    // Persist / update the user in the registry on every login
    await registry.upsertUser({
      id: String(user.id),
      githubUsername: user.githubUsername,
      email: user.email ?? "",
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    });

    // Cloud extension hook: NubeAuth provisioning, installation sync, etc.
    if (onAuthSuccess) {
      await onAuthSuccess({
        userId: String(user.id),
        githubToken: accessToken,
        githubUsername: user.githubUsername,
        ...(body.installation_id !== undefined ? { installationId: body.installation_id } : {}),
      });
    }

    let nextUrl = "/dashboard";
    if (body.installation_id === undefined) {
      try {
        const installRes = await fetch("https://api.github.com/user/installations?per_page=100", {
          signal: AbortSignal.timeout(10_000),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (installRes.ok) {
          const installBody = (await installRes.json()) as {
            installations?: Array<{
              id: number;
              app_id: number;
              account?: { id?: number; login?: string; type?: string } | null;
            }>;
          };

          const hasAnyAppInstall = (installBody.installations ?? []).some(
            (installation) => installation.app_id === appId,
          );

          if (!hasAnyAppInstall) {
            // Use /installations/new/permissions?target_id=…&state=… to land the
            // user directly on their account install page (skips account picker).
            //
            // GitHub echoes the state parameter back in the install redirect, so we
            // generate a fresh state, store it in the oauth_state cookie, and embed
            // it in the URL.  When GitHub redirects back with code+state+installation_id
            // the state check in POST /auth/callback will pass because the fresh
            // cookie and the echoed state match.
            const installState = randomBytes(16).toString("hex");
            setCookie(c, "oauth_state", installState, {
              httpOnly: true,
              secure: config.session.secure,
              sameSite: "Lax",
              path: "/",
              maxAge: 600,
            });
            nextUrl = `https://github.com/apps/${config.github.appSlug}/installations/new/permissions?target_id=${user.id}&target_type=User&state=${installState}`;
          }
        }
      } catch {
        // If the installation check fails, prefer a successful login over
        // blocking the user in the callback flow.
      }
    }

    // Store the GitHub token server-side (serialized with optional refresh token).
    // Use the refresh-token lifetime as the store TTL so it survives JWT session
    // renewals; the access token is auto-refreshed by the auth middleware.
    const sessionId = generateSessionId();
    const storeTtl = refreshTokenExpiresIn ?? SESSION_TTL_SECONDS;
    await tokenStore.set(
      sessionId,
      serializeToken({
        accessToken,
        ...(refreshToken !== undefined ? { refreshToken } : {}),
        ...(expiresIn !== undefined ? { expiresAt: Date.now() + expiresIn * 1000 } : {}),
      }),
      storeTtl,
    );

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
      // GitHub redirects back here after OAuth and App installation. `Lax`
      // keeps CSRF protection for subresource requests while still allowing
      // the session cookie on those top-level cross-site navigations.
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return c.json({ ok: true, data: { userId: user.id, nextUrl } });
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
   * GET /auth/github/user
   * Proxies GET /user to GitHub using the current session token.
   * Returns the raw GitHub response for debugging.
   */
  router.get("/github/user", async (c) => {
    const token = getCookie(c, config.session.cookieName);
    if (!token) return c.json({ ok: false, error: "Not authenticated" }, 401);
    const payload = verifySession(token, config.session.secret);
    if (!payload) return c.json({ ok: false, error: "Session expired" }, 401);
    const rawToken = await tokenStore.get(payload.sessionId);
    const stored = deserializeToken(rawToken);
    if (!stored) return c.json({ ok: false, error: "Session expired" }, 401);

    const res = await fetch("https://api.github.com/user", {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${stored.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const data = await res.json();
    return c.json({ ok: true, status: res.status, data });
  });

  /**
   * GET /auth/github/orgs
   * Proxies GET /user/orgs to GitHub using the current session token.
   * Returns the raw GitHub response for debugging.
   */
  router.get("/github/orgs", async (c) => {
    const token = getCookie(c, config.session.cookieName);
    if (!token) return c.json({ ok: false, error: "Not authenticated" }, 401);
    const payload = verifySession(token, config.session.secret);
    if (!payload) return c.json({ ok: false, error: "Session expired" }, 401);
    const rawToken2 = await tokenStore.get(payload.sessionId);
    const stored2 = deserializeToken(rawToken2);
    if (!stored2) return c.json({ ok: false, error: "Session expired" }, 401);

    const res = await fetch("https://api.github.com/user/orgs?per_page=100", {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${stored2.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const data = await res.json();
    return c.json({ ok: true, status: res.status, scopes: res.headers.get("x-oauth-scopes"), data });
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
