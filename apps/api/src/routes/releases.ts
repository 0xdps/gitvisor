import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { QueueRepository } from "@gitvisor/queue";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createReleasesRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
  queue: QueueRepository,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /releases?repositoryId=&page=&perPage=
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const repositoryId = c.req.query("repositoryId") || undefined;
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? 25)));
    const userDb = await getUserDb(user.id);
    const result = await userDb.listReleases({
      ...(repositoryId !== undefined ? { repositoryId } : {}),
      page,
      perPage,
    });
    return c.json({ ok: true, data: result });
  });

  /**
   * POST /releases/sync  — body: { repositoryId }
   */
  router.post("/sync", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{ repositoryId?: string }>();
    if (!body.repositoryId) return c.json({ ok: false, error: "repositoryId required" }, 400);
    const userDb = await getUserDb(user.id);
    const repos = await userDb.listRepositories();
    const repo = repos.find((r) => r.id === body.repositoryId);
    if (!repo) return c.json({ ok: false, error: "Repository not found" }, 404);
    await queue.enqueue({
      type: "sync:releases",
      data: {
        userId: user.id,
        installationId: repo.installationId,
        repositoryId: repo.id,
        fullName: repo.fullName,
      },
    });
    return c.json({ ok: true });
  });

  return router;
}
