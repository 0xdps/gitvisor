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
    cookieName: "gitvisor_session",
    secure: process.env["NODE_ENV"] === "production",
    // Must be at least 32 random characters. Used to sign session cookies.
    secret: requireEnv("SESSION_SECRET"),
  },
} as const;
