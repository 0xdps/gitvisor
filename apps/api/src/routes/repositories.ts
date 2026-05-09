import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";

export const repositoriesRouter = new Hono<AuthEnv>();

repositoriesRouter.use("*", requireAuth);

/**
 * GET /repositories
 * Lists all repositories synced for the current user.
 */
repositoriesRouter.get("/", async (c) => {
  const _user = c.get("user");

  // TODO: query UserDbRepository.listRepositories()
  return c.json({ ok: true, data: [] });
});

/**
 * GET /repositories/:repoId
 * Returns a single repository's details.
 */
repositoriesRouter.get("/:repoId", async (c) => {
  const _user = c.get("user");
  const _repoId = c.req.param("repoId");

  // TODO: query UserDbRepository.getRepository()
  return c.json({ ok: true, data: null });
});
