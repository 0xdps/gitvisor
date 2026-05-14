import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createAuditLogRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /audit-log?action=&resourceType=&resourceId=&page=&perPage=
   * Returns paginated audit log entries for the current user.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const action = c.req.query("action");
    const resourceType = c.req.query("resourceType");
    const resourceId = c.req.query("resourceId");
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? 50)));
    const userDb = await getUserDb(user.id);
    const result = await userDb.listAuditLog({
      ...(action !== undefined ? { action } : {}),
      ...(resourceType !== undefined ? { resourceType } : {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
      page,
      perPage,
    });
    return c.json({ ok: true, data: result });
  });

  return router;
}
