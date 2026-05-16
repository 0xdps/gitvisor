import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { UserDbRepository, RegistryRepository } from "@gitvisor/db";
import type { QueueRepository } from "@gitvisor/queue";
import type { AuthEnv } from "../middleware/auth.js";
import { makeUserRateLimiter } from "../middleware/rate-limit.js";

export function createPackagesRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
  registry: RegistryRepository,
  queue: QueueRepository,
) {
  const router = new Hono<AuthEnv>();

  // 10 package syncs per minute per user
  const syncLimiter = makeUserRateLimiter(10, 60_000);

  router.use("*", requireAuth);

  /**
   * GET /packages?repositoryId=
   * Lists packages synced for the current user (optionally filtered by repo).
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const repositoryId = c.req.query("repositoryId");
    const userDb = await getUserDb(user.id);
    const packages = await userDb.listPackages(repositoryId);
    return c.json({ ok: true, data: packages });
  });

  /**
   * POST /packages/sync
   * Enqueues a sync:packages job for a specific repository.
   * Validates that the installationId belongs to the current user (IDOR prevention).
   */
  router.post("/sync", async (c) => {
    const user = c.get("user");
    if (!syncLimiter(user.id)) return c.json({ ok: false, error: "Too many requests" }, 429);
    const { repositoryId, fullName, installationId } = await c.req.json<{
      repositoryId: string;
      fullName: string;
      installationId: number;
    }>();

    if (!repositoryId || !fullName || !installationId) {
      return c.json({ ok: false, error: "repositoryId, fullName, and installationId required" }, 400);
    }

    // Verify the installationId belongs to this user to prevent IDOR
    const userInstallations = await registry.listInstallationsByUser(user.id);
    const valid = userInstallations.find((i) => i.githubInstallationId === installationId);
    if (!valid) {
      return c.json({ ok: false, error: "Installation not found" }, 404);
    }

    await queue.enqueue(
      {
        type: "sync:packages",
        data: { userId: user.id, installationId, repositoryId, fullName },
      },
      { jobId: `sync_packages_${repositoryId}_${Date.now()}` },
    );

    return c.json({ ok: true, data: null });
  });

  return router;
}
