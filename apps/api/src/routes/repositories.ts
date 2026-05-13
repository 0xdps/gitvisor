import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createRepositoriesRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

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

  return router;
}
