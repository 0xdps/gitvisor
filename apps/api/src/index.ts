import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { createGitHubApp } from "@gitvisor/github";
import { BullMQQueueRepository } from "@gitvisor/queue";
import type { UserDbRepository } from "@gitvisor/db";

import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { createWorkflowsRouter } from "./routes/workflows.js";
import { createSecretsRouter } from "./routes/secrets.js";
import { repositoriesRouter } from "./routes/repositories.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createPublicRouter } from "./routes/public.js";

// ── GitHub App ───────────────────────────────────────────────────────────────
createGitHubApp(config.github);

// ── Queue ────────────────────────────────────────────────────────────────────
const queue = new BullMQQueueRepository({ redis: config.redis });

// ── UserDbRepository — inject your own implementation here ──────────────────
// OSS users: replace this stub with a concrete UserDbRepository implementation.
// Cloud: see cloud-apps/api which wires MesaHub automatically.
const getUserDb: (userId: string) => Promise<UserDbRepository> = async (_userId) => {
  throw new Error(
    "No UserDbRepository configured. " +
      "Provide a getUserDb implementation in apps/api/src/index.ts or use the cloud API.",
  );
};

// ── Hono App ─────────────────────────────────────────────────────────────────
const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  }),
);

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, service: "gitvisor-api" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.route("/auth", authRouter);
app.route("/repositories", repositoriesRouter);
app.route("/workflows", createWorkflowsRouter(getUserDb));
app.route("/secrets", createSecretsRouter(getUserDb));
app.route("/webhooks", createWebhookRouter(queue));
app.route("/public", createPublicRouter());

// ── 404 ──────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("[api] unhandled error:", err);
  return c.json({ ok: false, error: "Internal server error" }, 500);
});

// ── Start ────────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`[api] listening on port ${config.port}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  await queue.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
