import { Hono } from "hono";
import type { RegistryRepository } from "@gitvisor/db";
import type { UserDbRepository } from "@gitvisor/db";
import { makeIpRateLimiter, getClientIp } from "../middleware/rate-limit.js";

interface PublicTopRepo {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  runCount: number;
  successRate: number | null;
}

interface PublicRun {
  id: string;
  repoName: string;
  workflowName: string;
  branch: string;
  conclusion: string | null;
  status: string;
  startedAt: string | null;
  durationMs: number | null;
  htmlUrl: string;
}

interface PublicProfile {
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  /** ISO string of when the Gitvisor account was created */
  createdAt: string;
  stats: {
    repositoryCount: number;
    totalRuns: number;
    successCount: number;
    failureCount: number;
    workflowSuccessRate: number | null;
    avgRunDurationMs: number | null;
  };
  /** Top repos by run count over the last 91 days */
  topRepos: PublicTopRepo[];
  /** Most recent 12 workflow runs */
  recentRuns: PublicRun[];
  /** Language frequency across all tracked repositories */
  languageBreakdown: { language: string; count: number }[];
  /** Per-day run counts for the last 91 days, used to render the activity heatmap */
  activityHeatmap: { date: string; total: number; success: number }[];
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
      avgRunDurationMs: null,
    };
    let topRepos: PublicTopRepo[] = [];
    let recentRuns: PublicRun[] = [];
    let languageBreakdown: PublicProfile["languageBreakdown"] = [];
    let activityHeatmap: PublicProfile["activityHeatmap"] = [];

    try {
      const userDb = await getUserDb(user.id);
      const [repos, recentRunsRes, analytics] = await Promise.all([
        userDb.listRepositories(),
        userDb.listWorkflowRuns({ page: 1, perPage: 12 }),
        userDb.getAnalytics({ days: 91 }),
      ]);

      // --- stats ---
      const successCount = analytics.byDay.reduce(
        (s, d) => s + d.success,
        0,
      );
      const totalFromAnalytics = analytics.byDay.reduce(
        (s, d) => s + d.total,
        0,
      );
      // Use the paginator's total for the all-time run count
      const totalAllTime = recentRunsRes.total;

      const durations = recentRunsRes.items
        .filter((r) => r.durationMs != null)
        .map((r) => r.durationMs as number);
      const avgRunDurationMs =
        durations.length > 0
          ? Math.round(
              durations.reduce((s, d) => s + d, 0) / durations.length,
            )
          : null;

      stats = {
        repositoryCount: repos.length,
        totalRuns: totalAllTime,
        successCount,
        failureCount: totalFromAnalytics - successCount,
        workflowSuccessRate:
          totalFromAnalytics > 0
            ? Math.round((successCount / totalFromAnalytics) * 100)
            : null,
        avgRunDurationMs,
      };

      // --- language breakdown ---
      const langMap = new Map<string, number>();
      for (const repo of repos) {
        const lang = repo.language;
        if (lang) {
          langMap.set(lang, (langMap.get(lang) ?? 0) + 1);
        }
      }
      languageBreakdown = Array.from(langMap.entries())
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // --- top repos (by run count over the last 91 days) ---
      const repoById = new Map(repos.map((r) => [r.id, r]));
      topRepos = analytics.byRepo
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6)
        .map((r) => {
          const repo = repoById.get(r.repositoryId);
          return {
            id: r.repositoryId,
            name: repo?.name ?? r.repositoryId,
            fullName: repo?.fullName ?? r.repositoryId,
            language: repo?.language ?? null,
            runCount: r.total,
            successRate:
              r.total > 0 ? Math.round((r.success / r.total) * 100) : null,
          };
        });

      // --- recent runs ---
      recentRuns = recentRunsRes.items.map((run) => {
        const repo = repoById.get(run.repositoryId);
        return {
          id: run.id,
          repoName: repo?.name ?? run.repositoryId,
          workflowName: run.workflowName,
          branch: run.branch,
          conclusion: run.conclusion ?? null,
          status: run.status,
          startedAt: run.startedAt ?? null,
          durationMs: run.durationMs ?? null,
          htmlUrl: run.htmlUrl,
        };
      });

      // --- activity heatmap ---
      activityHeatmap = analytics.byDay;
    } catch {
      // UserDb not provisioned yet — return zero stats rather than 500
    }

    const profile: PublicProfile = {
      githubUsername: user.githubUsername,
      name: user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
      stats,
      topRepos,
      recentRuns,
      languageBreakdown,
      activityHeatmap,
    };

    return c.json({ ok: true, data: profile });
  });

  return router;
}
