import { NubeAuthClient } from "@nube-auth/client";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: Number(process.env["PORT"] ?? 3001),
  nodeEnv: process.env["NODE_ENV"] ?? "development",

  nubeAuth: {
    gatewayUrl: requireEnv("NUBE_AUTH_GATEWAY_URL"),
    appId: requireEnv("NUBE_AUTH_APP_ID"),
    appSecret: requireEnv("NUBE_AUTH_APP_SECRET"),
  },

  github: {
    appId: requireEnv("GITHUB_APP_ID"),
    privateKey: requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    webhookSecret: requireEnv("GITHUB_WEBHOOK_SECRET"),
    clientId: requireEnv("GITHUB_CLIENT_ID"),
    clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
  },

  redis: {
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
    password: process.env["REDIS_PASSWORD"],
  },

  session: {
    cookieName: "gitvisor_session",
    secure: process.env["NODE_ENV"] === "production",
  },
} as const;

export const nubeAuthClient = new NubeAuthClient({
  gatewayUrl: config.nubeAuth.gatewayUrl,
  appId: config.nubeAuth.appId,
  appSecret: config.nubeAuth.appSecret,
});
