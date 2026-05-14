import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createProfileRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /profile
   * Returns aggregated operational metrics for the authenticated user.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const userDb = await getUserDb(user.id);

    const [repos, totalStats] = await Promise.all([
      userDb.listRepositories(),
      userDb.listWorkflowRuns({ page: 1, perPage: 1 }),
    ]);

    // Compute success metrics over up to 100 runs
    const allRunsForStats = await userDb.listWorkflowRuns({ page: 1, perPage: 100 });
    const successCount = allRunsForStats.items.filter((r) => r.conclusion === "success").length;
    const failureCount = allRunsForStats.items.filter(
      (r) => r.conclusion === "failure" || r.conclusion === "timed_out",
    ).length;
    // Only report success rate when we have the full picture (≤100 runs)
    const workflowSuccessRate =
      totalStats.total > 0 && totalStats.total <= 100
        ? Math.round((successCount / totalStats.total) * 100)
        : null;

    return c.json({
      ok: true,
      data: {
        userId: user.id,
        githubUsername: user.githubUsername,
        name: user.name,
        avatarUrl: user.avatarUrl,
        stats: {
          repositoryCount: repos.length,
          totalRuns: totalStats.total,
          successCount,
          failureCount,
          workflowSuccessRate,
        },
      },
    });
  });

  return router;
}
