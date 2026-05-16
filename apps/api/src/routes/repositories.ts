import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getInstallationOctokit } from "@gitvisor/github";
import type { UserDbRepository, RegistryRepository } from "@gitvisor/db";
import type { QueueRepository } from "@gitvisor/queue";
import type { AuthEnv } from "../middleware/auth.js";
import { makeUserRateLimiter } from "../middleware/rate-limit.js";
import { createLogger } from "@gitvisor/logger";

export function createRepositoriesRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
  registry: RegistryRepository,
  queue: QueueRepository,
) {
  const router = new Hono<AuthEnv>();
  const log = createLogger("repositories");

  // 3 full syncs per minute per user — each sync may enqueue hundreds of jobs
  const syncLimiter = makeUserRateLimiter(3, 60_000);

  router.use("*", requireAuth);

  /**
   * GET /repositories
   * Lists all repositories synced for the current user.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const db = await getUserDb(user.id);
    const repositories = await db.listRepositories();
    return c.json({ ok: true, data: repositories });
  });

  /**
   * GET /repositories/:repoId
   * Returns a single repository by its GitHub repo ID.
   */
  router.get("/:repoId", async (c) => {
    const user = c.get("user");
    const repoId = Number(c.req.param("repoId"));
    if (isNaN(repoId)) {
      return c.json({ ok: false, error: "Invalid repository ID" }, 400);
    }
    const db = await getUserDb(user.id);
    const repository = await db.getRepository(repoId);
    if (!repository) {
      return c.json({ ok: false, error: "Repository not found" }, 404);
    }
    return c.json({ ok: true, data: repository });
  });

  /**
   * POST /repositories/sync
   * Discovers all repos accessible via the user's GitHub App installations
   * and enqueues a sync:repo job for each one.
   */
  router.post("/sync", async (c) => {
    const user = c.get("user");
    if (!syncLimiter(user.id)) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }
    const installations = await registry.listInstallationsByUser(user.id);
    if (installations.length === 0) {
      return c.json({ ok: true, data: { queued: 0 } });
    }

    let queued = 0;
    for (const installation of installations) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const octokit = await getInstallationOctokit(installation.githubInstallationId) as any;
        let page = 1;
        const MAX_SYNC_PAGES = 50;
        while (page <= MAX_SYNC_PAGES) {
          const { data } = await octokit.request("GET /installation/repositories", {
            per_page: 100,
            page,
          }) as { data: { repositories: Array<{ id: number; full_name: string }> } };
          for (const repo of data.repositories) {
            await queue.enqueue(
              {
                type: "sync:repo",
                data: {
                  userId: user.id,
                  installationId: installation.githubInstallationId,
                  repositoryId: String(repo.id),
                  githubRepoId: repo.id,
                  fullName: repo.full_name,
                },
              },
              { jobId: `sync_repo_${repo.id}_${Date.now()}` },
            );
            queued++;
          }
          if (data.repositories.length < 100) break;
          page++;
        }
      } catch (err) {
        // Non-fatal: log and continue with next installation
        log.warn(
          { err, installationId: installation.githubInstallationId },
          "sync failed for installation — it may be stale or have no repo access",
        );
      }
    }

    return c.json({ ok: true, data: { queued } });
  });

  return router;
}
