import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { UserDbRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

export function createAnalyticsRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /analytics?days=30
   * Returns per-repo run counts and daily time-series for the last N days.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const days = Math.min(90, Math.max(7, Number(c.req.query("days") ?? 30)));
    const userDb = await getUserDb(user.id);
    const data = await userDb.getAnalytics({ days });
    return c.json({ ok: true, data });
  });

  return router;
}
