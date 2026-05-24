function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  nodeEnv: process.env["NODE_ENV"] ?? "development",

  github: {
    appId: requireEnv("GITHUB_APP_ID"),
    privateKey: requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    webhookSecret: requireEnv("GITHUB_WEBHOOK_SECRET"),
    clientId: requireEnv("GITHUB_CLIENT_ID"),
    clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
    // Full URL that GitHub will redirect back to after OAuth.
    // Must be registered in your GitHub App's callback URL list.
    oauthRedirectUri: requireEnv("GITHUB_OAUTH_REDIRECT_URI"),
    // The slug of the GitHub App (the {slug} part of github.com/apps/{slug}).
    // Used to build the unified installation + OAuth URL so signup and App
    // installation happen in a single GitHub screen.
    appSlug: requireEnv("GITHUB_APP_SLUG"),
  },

  redis: {
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
    password: process.env["REDIS_PASSWORD"],
  },

  session: {
    // __Host- prefix enforces Secure + Path=/ + no Domain attribute in production (HTTPS)
    cookieName: process.env["NODE_ENV"] === "production" ? "__Host-gitvisor_session" : "gitvisor_session",
    secure: process.env["NODE_ENV"] === "production",
    // Must be at least 32 random characters. Used to sign session cookies (HMAC-SHA256).
    secret: (() => {
      const s = requireEnv("SESSION_SECRET");
      if (s.length < 32) throw new Error(`SESSION_SECRET is too short (${s.length} chars); minimum is 32`);
      return s;
    })(),
  },

  /**
   * Cloudflare Turnstile bot-protection (optional).
   * Set CF_TURNSTILE_SECRET_KEY in the API environment to enable server-side
   * token verification on the login endpoint.  The corresponding site key
   * (NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY) must also be set in the web app.
   *
   * When unset, Turnstile verification is skipped — safe for self-hosted
   * deployments that do not use Cloudflare.
   */
  turnstile: {
    secretKey: process.env["CF_TURNSTILE_SECRET_KEY"] ?? null,
  },
} as const;
