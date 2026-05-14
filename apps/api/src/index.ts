import { serve } from "@hono/node-server";
import { createGitHubApp } from "@gitvisor/github";
import { BullMQQueueRepository } from "@gitvisor/queue";
import { createSharedSqliteRepositories } from "@gitvisor/db";
import { InMemoryTokenStore } from "@gitvisor/auth";
import { createLogger } from "@gitvisor/logger";
import { config } from "./config.js";
import { createCoreApp } from "./app.js";

const log = createLogger("api");

// ── GitHub App ───────────────────────────────────────────────────────────────
createGitHubApp(config.github);

// ── Infrastructure ────────────────────────────────────────────────────────────
const queue = new BullMQQueueRepository({ redis: config.redis });

const { getUserDb, registry } = await createSharedSqliteRepositories({
  registryPath: process.env["REGISTRY_DB_PATH"] ?? "./registry.sqlite",
  dataPath: process.env["DATA_DB_PATH"] ?? "./data.sqlite",
});

// InMemoryTokenStore keeps OAuth tokens out of the session cookie.
// Suitable for single-instance self-hosted deployments.
const tokenStore = new InMemoryTokenStore();

// ── App ───────────────────────────────────────────────────────────────────────
const app = createCoreApp({
  queue,
  getUserDb,
  registry,
  tokenStore,
  ...(process.env["ALLOWED_ORIGINS"]
    ? { allowedOrigins: process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim()) }
    : {}),
});

// ── Start ─────────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: config.port }, () => {
  log.info({ port: config.port }, "listening");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async () => {
  await queue.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
