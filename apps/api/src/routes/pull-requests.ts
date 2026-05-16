import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getInstallationOctokit, listOpenPullRequests } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";
import type { RepoPullRequest } from "@gitvisor/shared";

export function createPullRequestsRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /pull-requests?limit=30
   *
   * Fetches open PRs across all tracked repos live from GitHub.
   * Only hits repos where openPullsCount > 0 to minimise API calls —
   * we use the cached count from the last repository sync as a gate.
   *
   * Repos are grouped by installationId so each installation token is
   * obtained once and shared across its repos.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50)));

    const userDb = await getUserDb(user.id);
    const repos = await userDb.listRepositories();

    // Only hit repos we know have open PRs (avoids pointless API calls)
    const reposWithPRs = repos.filter((r) => r.openPullsCount > 0 && !r.archived);

    // Group by installationId — one octokit per installation
    const byInstallation = new Map<number, typeof repos>();
    for (const repo of reposWithPRs) {
      const arr = byInstallation.get(repo.installationId) ?? [];
      arr.push(repo);
      byInstallation.set(repo.installationId, arr);
    }

    const results: RepoPullRequest[] = [];

    await Promise.all(
      [...byInstallation.entries()].map(async ([installationId, installRepos]) => {
        const octokit = await getInstallationOctokit(installationId);
        await Promise.all(
          installRepos.map(async (repo) => {
            try {
              const prs = await listOpenPullRequests(octokit as never, repo.owner, repo.name);
              for (const pr of prs) {
                results.push({ ...pr, repoId: repo.id, repoFullName: repo.fullName });
              }
            } catch {
              // Silently skip — repo may be archived, deleted, or have revoked permissions
            }
          }),
        );
      }),
    );

    // Most recently updated first
    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return c.json({ ok: true, data: results.slice(0, limit) });
  });

  return router;
}
