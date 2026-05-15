import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getInstallationOctokit, rerunWorkflow, cancelWorkflowRun } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createWorkflowsRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /workflows?repositoryId=&page=&perPage=
   * Lists workflow runs from the user's DB (no GitHub API call).
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const repositoryId = c.req.query("repositoryId");
    const status = c.req.query("status");
    const workflowName = c.req.query("workflowName");
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? 25)));
    const userDb = await getUserDb(user.id);
    const result = await userDb.listWorkflowRuns({
      ...(repositoryId !== undefined ? { repositoryId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(workflowName ? { workflowName } : {}),
      page,
      perPage,
    });
    return c.json({ ok: true, data: result });
  });

  /**
   * POST /workflows/:runId/rerun
   * Reruns a workflow via GitHub API.
   */
  router.post("/:runId/rerun", async (c) => {
    const user = c.get("user");
    const runId = Number(c.req.param("runId"));
    if (!Number.isFinite(runId)) return c.json({ ok: false, error: "Invalid run ID" }, 400);
    const userDb = await getUserDb(user.id);
    const run = await userDb.getWorkflowRun(runId);
    if (!run) return c.json({ ok: false, error: "Not found" }, 404);
    const repo = await userDb.getRepository(Number(run.repositoryId));
    if (!repo) return c.json({ ok: false, error: "Repository not found" }, 404);
    const octokit = await getInstallationOctokit(repo.installationId);
    await rerunWorkflow(octokit as never, repo.owner, repo.name, runId);
    return c.json({ ok: true, data: null });
  });

  /**
   * POST /workflows/:runId/cancel
   * Cancels a running workflow via GitHub API.
   */
  router.post("/:runId/cancel", async (c) => {
    const user = c.get("user");
    const runId = Number(c.req.param("runId"));
    if (!Number.isFinite(runId)) return c.json({ ok: false, error: "Invalid run ID" }, 400);
    const userDb = await getUserDb(user.id);
    const run = await userDb.getWorkflowRun(runId);
    if (!run) return c.json({ ok: false, error: "Not found" }, 404);
    const repo = await userDb.getRepository(Number(run.repositoryId));
    if (!repo) return c.json({ ok: false, error: "Repository not found" }, 404);
    const octokit = await getInstallationOctokit(repo.installationId);
    await cancelWorkflowRun(octokit as never, repo.owner, repo.name, runId);
    return c.json({ ok: true, data: null });
  });

  return router;
}
