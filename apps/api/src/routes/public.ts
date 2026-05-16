import { Hono } from "hono";
import type { RegistryRepository } from "@gitvisor/db";
import type { UserDbRepository } from "@gitvisor/db";
import { makeIpRateLimiter, getClientIp } from "../middleware/rate-limit.js";

interface PublicProfile {
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  stats: {
    repositoryCount: number;
    totalRuns: number;
    successCount: number;
    failureCount: number;
    workflowSuccessRate: number | null;
  };
}

/**
 * Public profile router — no authentication required.
 * GET /public/:username → returns a user's public GitVisor profile.
 *
 * OSS users: provide a registry and getUserDb implementation via
 * createPublicRouter() to enable this endpoint. Until then the route
 * returns a stub 404.
 */
export function createPublicRouter(
  registry?: RegistryRepository,
  getUserDb?: (userId: string) => Promise<UserDbRepository>,
) {
  const router = new Hono();

  // 30 lookups per minute per IP — prevents automated username enumeration
  const profileLimiter = makeIpRateLimiter(30, 60_000);

  router.get("/:username", async (c) => {
    const ip = getClientIp(c.req);
    if (!profileLimiter(ip)) {
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }
    const username = c.req.param("username");

    if (!registry || !getUserDb) {
      // Stub: no registry configured yet
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    const user = await registry.getUserByGithubUsername(username);
    if (!user) {
      return c.json({ ok: false, error: "User not found" }, 404);
    }

    let stats: PublicProfile["stats"] = {
      repositoryCount: 0,
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      workflowSuccessRate: null,
    };

    try {
      const userDb = await getUserDb(user.id);
      const [repos, runs] = await Promise.all([
        userDb.listRepositories(),
        userDb.listWorkflowRuns({ page: 1, perPage: 1000 }),
      ]);

      const successCount = runs.items.filter(
        (r) => r.conclusion === "success",
      ).length;
      const failureCount = runs.items.filter(
        (r) => r.conclusion === "failure" || r.conclusion === "timed_out",
      ).length;
      const total = runs.total;

      stats = {
        repositoryCount: repos.length,
        totalRuns: total,
        successCount,
        failureCount,
        workflowSuccessRate:
          total > 0 ? Math.round((successCount / total) * 100) : null,
      };
    } catch {
      // UserDb not provisioned yet — return zero stats rather than 500
    }

    const profile: PublicProfile = {
      githubUsername: user.githubUsername,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
      stats,
    };

    return c.json({ ok: true, data: profile });
  });

  return router;
}
