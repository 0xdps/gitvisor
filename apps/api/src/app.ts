import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { QueueRepository } from "@gitvisor/queue";
import type { RegistryRepository, UserDbRepository } from "@gitvisor/db";
import type { TokenStore } from "@gitvisor/auth";
import { createLogger } from "@gitvisor/logger";
import { createRequireAuth } from "./middleware/auth.js";
import { createAuthRouter, type AuthSuccessContext } from "./routes/auth.js";
import { createWorkflowsRouter } from "./routes/workflows.js";
import { createSecretsRouter } from "./routes/secrets.js";
import { createRepositoriesRouter } from "./routes/repositories.js";
import { createWebhookRouter } from "./routes/webhooks.js";
import { createPublicRouter } from "./routes/public.js";
import { createInstallationsRouter } from "./routes/installations.js";
import { createPackagesRouter } from "./routes/packages.js";
import { createProfileRouter } from "./routes/profile.js";
import { createAuditLogRouter } from "./routes/audit-log.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createReleasesRouter } from "./routes/releases.js";
import { createPullRequestsRouter } from "./routes/pull-requests.js";

const log = createLogger("api");

export type { AuthSuccessContext };

export interface CoreAppDeps {
  queue: QueueRepository;
  getUserDb: (userId: string) => Promise<UserDbRepository>;
  registry: RegistryRepository;
  tokenStore: TokenStore;
  /** CORS allowed origins. Defaults to ["http://localhost:3000"]. */
  allowedOrigins?: string[];
  /**
   * Called after the user has been upserted in the registry on every login,
   * before the session cookie is issued.
   *
   * Cloud uses this for NubeAuth provisioning, installation sync, and
   * per-user DB pre-migration — all cloud-specific side effects.
   */
  onAuthSuccess?: (ctx: AuthSuccessContext) => Promise<void>;
}

/**
 * Builds and returns the core Hono application wired up with the provided
 * infrastructure adapters (queue, db, token store).
 *
 * Consumed by `index.ts` for self-hosted deployments, and importable by
 * cloud extensions via `@gitvisor/api/app` to reuse all routes with
 * cloud-specific adapter implementations (e.g. MesaHub instead of SQLite).
 *
 * @example Cloud extension usage
 * ```ts
 * import { createCoreApp } from "@gitvisor/api/app";
 * const app = createCoreApp({ queue, getUserDb, registry, tokenStore });
 * app.route("/billing", billingRouter);
 * serve({ fetch: app.fetch, port });
 * ```
 */
export function createCoreApp({
  queue,
  getUserDb,
  registry,
  tokenStore,
  allowedOrigins,
  onAuthSuccess,
}: CoreAppDeps) {
  const requireAuth = createRequireAuth(tokenStore);

  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: allowedOrigins ?? ["http://localhost:3000"],
      credentials: true,
    }),
  );

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/health", (c) => c.json({ ok: true, service: "gitvisor-api" }));

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.route("/auth",           createAuthRouter(registry, tokenStore, onAuthSuccess));
  app.route("/repositories",   createRepositoriesRouter(getUserDb, requireAuth, registry, queue));
  app.route("/workflows",      createWorkflowsRouter(getUserDb, requireAuth));
  app.route("/secrets",        createSecretsRouter(getUserDb, requireAuth));
  app.route("/webhooks",       createWebhookRouter(queue, getUserDb, requireAuth));
  app.route("/installations",  createInstallationsRouter(registry, requireAuth));
  app.route("/packages",       createPackagesRouter(getUserDb, requireAuth, registry, queue));
  app.route("/profile",        createProfileRouter(getUserDb, requireAuth));
  app.route("/audit-log",      createAuditLogRouter(getUserDb, requireAuth));
  app.route("/analytics",      createAnalyticsRouter(getUserDb, requireAuth));
  app.route("/releases",       createReleasesRouter(getUserDb, requireAuth, queue));
  app.route("/pull-requests",  createPullRequestsRouter(getUserDb, requireAuth));
  app.route("/public",         createPublicRouter(registry, getUserDb));

  // ── Error handling ─────────────────────────────────────────────────────────
  app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

  app.onError((err, c) => {
    log.error({ err }, "unhandled error");
    return c.json({ ok: false, error: "Internal server error" }, 500);
  });

  return app;
}
