const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * Build the GitHub OAuth authorization URL.
 * Redirects the user to GitHub to grant access.
 */
export function buildGitHubOAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email read:org",
    ...(state ? { state } : {}),
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Build the GitHub App installation URL.
 *
 * Starting the auth flow here (instead of the plain OAuth URL) combines
 * three things into a single GitHub screen:
 *   1. OAuth user authorization (identity + email + any extra scopes).
 *   2. GitHub App installation — user picks an account.
 *   3. CSRF state is threaded through and validated on callback.
 *
 * Prerequisite: the GitHub App must have
 * "Request user authorization (OAuth) during installation" enabled in its
 * Settings → General page.  Without that setting GitHub will not include
 * the `code` parameter in the redirect and login will fail.
 *
 * The optional `scope` parameter lets you request additional OAuth scopes
 * on top of the defaults (`read:user user:email`).  GitHub supports this
 * when the App has user-authorization enabled.
 *
 * After the user completes the flow GitHub redirects to the app's callback
 * URL with:
 *   ?code={code}&installation_id={id}&setup_action=install&state={state}
 */
export function buildGitHubAppInstallUrl(
  appSlug: string,
  state?: string,
  scope?: string,
): string {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (scope) params.set("scope", scope);
  const qs = params.toString();
  return `https://github.com/apps/${appSlug}/installations/new${qs ? `?${qs}` : ""}`;
}

export interface GitHubOAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  scope: string;
  /** Present when the GitHub App has "Expire user authorization tokens" enabled. */
  refreshToken?: string;
  /** Seconds until the access token expires (28800 = 8 h when token expiry is on). */
  expiresIn?: number;
  /** Seconds until the refresh token expires (~6 months). */
  refreshTokenExpiresIn?: number;
}

/**
 * Exchange an OAuth authorization code for an access token.
 * Must be called server-side (requires client_secret).
 */
export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<GitHubOAuthTokenResponse> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    refresh_token?: string;
    expires_in?: string | number;
    refresh_token_expires_in?: string | number;
    error?: string;
    error_description?: string;
  };

  if (data.error ?? !data.access_token) {
    throw new Error(
      `GitHub OAuth error: ${data.error_description ?? data.error ?? "unknown"}`,
    );
  }

  return {
    accessToken: data.access_token!,
    tokenType: data.token_type ?? "bearer",
    scope: data.scope ?? "",
    ...(data.refresh_token !== undefined ? { refreshToken: data.refresh_token } : {}),
    ...(data.expires_in !== undefined ? { expiresIn: Number(data.expires_in) } : {}),
    ...(data.refresh_token_expires_in !== undefined ? { refreshTokenExpiresIn: Number(data.refresh_token_expires_in) } : {}),
  };
}

/**
 * Refresh an expired GitHub App access token using the stored refresh token.
 * Only valid when the GitHub App has "Expire user authorization tokens" enabled.
 * Throws if the refresh fails (invalid/expired refresh token).
 */
export async function refreshGitHubToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GitHubOAuthTokenResponse> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    refresh_token?: string;
    expires_in?: string | number;
    refresh_token_expires_in?: string | number;
    error?: string;
    error_description?: string;
  };

  if (data.error ?? !data.access_token) {
    throw new Error(
      `GitHub token refresh error: ${data.error_description ?? data.error ?? "unknown"}`,
    );
  }

  return {
    accessToken: data.access_token!,
    tokenType: data.token_type ?? "bearer",
    scope: data.scope ?? "",
    ...(data.refresh_token !== undefined ? { refreshToken: data.refresh_token } : {}),
    ...(data.expires_in !== undefined ? { expiresIn: Number(data.expires_in) } : {}),
    ...(data.refresh_token_expires_in !== undefined ? { refreshTokenExpiresIn: Number(data.refresh_token_expires_in) } : {}),
  };
}
