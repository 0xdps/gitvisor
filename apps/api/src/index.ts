import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { createGitHubApp } from "@gitvisor/github";
import { BullMQQueueRepository } from "@gitvisor/queue";
import { createSharedSqliteRepositories } from "@gitvisor/db";
import { InMemoryTokenStore } from "@gitvisor/auth";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("api");

import { config } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";
import { createWorkflowsRouter } from "./routes/workflows.js";
import { createSecretsRouter } from "./routes/secrets.js";
import { createRepositoriesRouter } from "./routes/repositories.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createPublicRouter } from "./routes/public.js";
import { createRequireAuth } from "./middleware/auth.js";

// ── GitHub App ───────────────────────────────────────────────────────────────
createGitHubApp(config.github);

// ── Queue ────────────────────────────────────────────────────────────────────
const queue = new BullMQQueueRepository({ redis: config.redis });

// ── Database ─────────────────────────────────────────────────────────────────
const { getUserDb, registry } = await createSharedSqliteRepositories({
  registryPath: process.env["REGISTRY_DB_PATH"] ?? "./registry.sqlite",
  dataPath: process.env["DATA_DB_PATH"] ?? "./data.sqlite",
});

// ── Token store ───────────────────────────────────────────────────────────────
// Keeps GitHub OAuth tokens out of the session cookie.
// InMemoryTokenStore is suitable for single-instance self-hosted deployments.
const tokenStore = new InMemoryTokenStore();
const requireAuth = createRequireAuth(tokenStore);

// ── Hono App ─────────────────────────────────────────────────────────────────
const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",").map((o) => o.trim()) ?? ["http://localhost:3000"],
    credentials: true,
  }),
);

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, service: "gitvisor-api" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.route("/auth", createAuthRouter(registry, tokenStore));
app.route("/repositories", createRepositoriesRouter(getUserDb, requireAuth));
app.route("/workflows", createWorkflowsRouter(getUserDb, requireAuth));
app.route("/secrets", createSecretsRouter(getUserDb, requireAuth));
app.route("/webhooks", createWebhookRouter(queue));
app.route("/public", createPublicRouter(registry, getUserDb));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

app.onError((err, c) => {
  log.error({ err }, "unhandled error");
  return c.json({ ok: false, error: "Internal server error" }, 500);
});

// ── Start ────────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: config.port }, () => {
  log.info({ port: config.port }, "listening");
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  await queue.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
