import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";

export const workflowsRouter = new Hono<AuthEnv>();

workflowsRouter.use("*", requireAuth);

/**
 * GET /workflows?repositoryId=&page=&perPage=
 * Lists workflow runs from the user's MesaHub DB (no GitHub API call).
 */
workflowsRouter.get("/", async (c) => {
  const _user = c.get("user");
  const _repositoryId = c.req.query("repositoryId");
  const _page = Number(c.req.query("page") ?? 1);
  const _perPage = Number(c.req.query("perPage") ?? 25);

  // TODO: inject UserDbRepository and query MesaHub
  return c.json({ ok: true, data: { items: [], total: 0, page: _page, perPage: _perPage, hasMore: false } });
});

/**
 * POST /workflows/:runId/rerun
 * Reruns a workflow via GitHub API.
 */
workflowsRouter.post("/:runId/rerun", async (c) => {
  const _user = c.get("user");
  const _runId = Number(c.req.param("runId"));

  // TODO: resolve installation, call rerunWorkflow()
  return c.json({ ok: true, data: null });
});

/**
 * POST /workflows/:runId/cancel
 * Cancels a running workflow via GitHub API.
 */
workflowsRouter.post("/:runId/cancel", async (c) => {
  const _user = c.get("user");
  const _runId = Number(c.req.param("runId"));

  // TODO: resolve installation, call cancelWorkflowRun()
  return c.json({ ok: true, data: null });
});
