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
    scope: "read:user user:email",
    ...(state ? { state } : {}),
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export interface GitHubOAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  scope: string;
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
  };
}
