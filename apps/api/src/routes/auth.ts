import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { randomBytes, createHash } from "node:crypto";
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
import type { RegistryRepository, UserDbRepository } from "@gitvisor/db";
import { config } from "../config.js";
import { makeIpRateLimiter, getClientIp } from "../middleware/rate-limit.js";

const authCallbackLimiter = makeIpRateLimiter(10, 60_000);
const loginStartLimiter = makeIpRateLimiter(20, 60_000);

/**
 * Verify a Cloudflare Turnstile challenge token.
 * Returns true when Turnstile is not configured (skipped) or when the token
 * is accepted.  Fails open on network errors so a Cloudflare outage cannot
 * lock users out.
 */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!config.turnstile.secretKey) return true;
  const body = new URLSearchParams({
    secret: config.turnstile.secretKey,
    response: token,
    remoteip: ip,
  });
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body, signal: AbortSignal.timeout(5_000) },
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    // Fail open — a Cloudflare outage should not prevent logins
    return true;
  }
}

/** Return first 16 hex chars of SHA-256(value) — used for UA fingerprinting. */
function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

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
  getUserDb?: (userId: string) => Promise<UserDbRepository>,
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
  router.get("/login", async (c) => {
    const ip = getClientIp(c.req);
    if (!loginStartLimiter(ip)) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }

    // Verify Cloudflare Turnstile challenge when configured.
    // Self-hosted deployments that do not set CF_TURNSTILE_SECRET_KEY skip this.
    if (config.turnstile.secretKey) {
      const turnstileToken = c.req.query("turnstile_token");
      if (!turnstileToken) {
        return c.json({ ok: false, error: "Security challenge required" }, 403);
      }
      const valid = await verifyTurnstile(turnstileToken, ip);
      if (!valid) {
        return c.json({ ok: false, error: "Security challenge failed" }, 403);
      }
    }

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
    const userId = String(user.id);

    // Fetch the existing registry record BEFORE upsert so we can detect
    // credential changes that may indicate GitHub account compromise.
    const existingUser = await registry.getUserById(userId).catch(() => null);

    // Persist / update the user in the registry on every login
    await registry.upsertUser({
      id: userId,
      githubUsername: user.githubUsername,
      email: user.email ?? "",
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
    });

    // Cloud extension hook: NubeAuth provisioning, installation sync, etc.
    if (onAuthSuccess) {
      await onAuthSuccess({
        userId,
        githubToken: accessToken,
        githubUsername: user.githubUsername,
        ...(body.installation_id !== undefined ? { installationId: body.installation_id } : {}),
      });
    }

    // ── GitHub account compromise detection ──────────────────────────────────
    // Compare the live GitHub data with what was last stored in the registry.
    // A changed username or email can indicate account hijacking or OAuth app
    // abuse — record a security alert in the audit log for review.
    if (existingUser && getUserDb) {
      const alerts: Record<string, unknown>[] = [];
      if (existingUser.githubUsername !== user.githubUsername) {
        alerts.push({
          type: "github_username_changed",
          previous: existingUser.githubUsername,
          current: user.githubUsername,
        });
      }
      if (existingUser.email && user.email && existingUser.email !== user.email) {
        alerts.push({
          type: "github_email_changed",
          previous: existingUser.email,
          current: user.email,
        });
      }
      if (alerts.length > 0) {
        const userDb = await getUserDb(userId).catch(() => null);
        if (userDb) {
          for (const alert of alerts) {
            await userDb
              .appendAuditLog({
                userId,
                action: "security.alert",
                resourceType: "account",
                resourceId: userId,
                metadata: { ...alert, ip: getClientIp(c.req) },
              })
              .catch(() => {}); // Never block login on audit failure
          }
        }
      }
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

    // UA fingerprint — stored in the session so the auth middleware can emit
    // a security alert when the User-Agent changes between requests (which can
    // indicate session token theft).  We intentionally do NOT block on mismatch
    // because browsers auto-update and change their UA silently.
    const uaHash = shortHash(c.req.header("user-agent") ?? "");

    const token = signSession(
      {
        sessionId,
        userId,
        githubUsername: user.githubUsername,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        uaHash,
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

    // Audit: record the successful login with IP + UA so suspicious sessions
    // can be identified when reviewing the audit log.
    if (getUserDb) {
      const userDb = await getUserDb(userId).catch(() => null);
      if (userDb) {
        await userDb
          .appendAuditLog({
            userId,
            action: "auth.login",
            resourceType: "session",
            resourceId: sessionId,
            metadata: {
              ip: getClientIp(c.req),
              ua: (c.req.header("user-agent") ?? "").slice(0, 200),
              newUser: !existingUser,
            },
          })
          .catch(() => {});
      }
    }

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
   * Development / debugging only — not available in production.
   */
  router.get("/github/user", async (c) => {
    if (config.nodeEnv === "production") {
      return c.json({ ok: false, error: "Not found" }, 404);
    }
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
   * Development / debugging only — not available in production.
   */
  router.get("/github/orgs", async (c) => {
    if (config.nodeEnv === "production") {
      return c.json({ ok: false, error: "Not found" }, 404);
    }
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
        // Audit the logout event
        if (getUserDb) {
          const userDb = await getUserDb(payload.userId).catch(() => null);
          if (userDb) {
            await userDb
              .appendAuditLog({
                userId: payload.userId,
                action: "auth.logout",
                resourceType: "session",
                resourceId: payload.sessionId,
                metadata: { ip: getClientIp(c.req) },
              })
              .catch(() => {});
          }
        }
      }
    }
    deleteCookie(c, config.session.cookieName, { path: "/" });
    return c.json({ ok: true, data: null });
  });

  return router;
}
