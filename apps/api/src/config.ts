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
} as const;
