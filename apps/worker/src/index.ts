import { createGitHubApp } from "@gitvisor/github";
import { BullMQQueueRepository } from "@gitvisor/queue";
import type { UserDbRepository } from "@gitvisor/db";
import { dispatch } from "./handlers/index.js";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// ── GitHub App ───────────────────────────────────────────────────────────────
createGitHubApp({
  appId: requireEnv("GITHUB_APP_ID"),
  privateKey: requireEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
  webhookSecret: requireEnv("GITHUB_WEBHOOK_SECRET"),
  clientId: requireEnv("GITHUB_CLIENT_ID"),
  clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
});

// ── Queue ────────────────────────────────────────────────────────────────────
const queue = new BullMQQueueRepository({
  redis: {
    host: process.env["REDIS_HOST"] ?? "localhost",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
    password: process.env["REDIS_PASSWORD"],
  },
});

/**
 * Stub: resolves a UserDbRepository for a given userId.
 * TODO: replace with MesaHub implementation once API spec is integrated.
 */
async function getUserDb(_userId: string): Promise<UserDbRepository> {
  throw new Error("UserDbRepository not yet implemented — awaiting MesaHub API spec");
}

// ── Start processing ─────────────────────────────────────────────────────────
queue.process(async (job) => {
  await dispatch(job, getUserDb);
});

console.log("[worker] started — waiting for jobs");

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  await queue.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
