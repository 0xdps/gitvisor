import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { createWebhookHandler } from "@gitvisor/github";
import type { QueueRepository } from "@gitvisor/queue";
import type { UserDbRepository } from "@gitvisor/db";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { JobData } from "@gitvisor/shared";
import type { AuthEnv } from "../middleware/auth.js";

export function createWebhookRouter(
  queue: QueueRepository,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  const webhooks = createWebhookHandler(
    config.github.webhookSecret,
    async (job: JobData) => {
      const resourceId = "repositoryId" in job.data ? job.data.repositoryId : job.data.githubInstallationId;
      await queue.enqueue(job, {
        jobId: `${job.type}:${resourceId}:${Date.now()}`,
      });
    },
  );

  /**
   * POST /webhooks/github
   * Receives GitHub App webhook events, verifies signature, dispatches to queue.
   */
  router.post("/github", async (c) => {
    const signature = c.req.header("x-hub-signature-256");
    const rawBody = await c.req.text();

    if (!signature) {
      return c.json({ ok: false, error: "Missing signature" }, 400);
    }

    try {
      await webhooks.verifyAndReceive({
        id: c.req.header("x-github-delivery") ?? "",
        name: c.req.header("x-github-event") as Parameters<typeof webhooks.verifyAndReceive>[0]["name"],
        signature,
        payload: rawBody,
      });
      return c.json({ ok: true }, 200);
    } catch {
      return c.json({ ok: false, error: "Invalid webhook payload" }, 400);
    }
  });

  /**
   * GET /webhooks/events?status=&eventName=&resourceId=&page=&perPage=
   * Lists stored webhook events for the current user.
   */
  router.get("/events", requireAuth, async (c) => {
    const user = c.get("user");
    const status = c.req.query("status");
    const eventName = c.req.query("eventName");
    const resourceId = c.req.query("resourceId");
    const page = Math.max(1, Number(c.req.query("page") ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? 50)));
    const userDb = await getUserDb(user.id);
    const result = await userDb.listWebhookEvents({
      ...(status !== undefined ? { status } : {}),
      ...(eventName !== undefined ? { eventName } : {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
      page,
      perPage,
    });
    return c.json({ ok: true, data: result });
  });

  /**
   * POST /webhooks/events/:deliveryId/replay
   * Re-dispatches a stored webhook event through the handler (no signature check).
   */
  router.post("/events/:deliveryId/replay", requireAuth, async (c) => {
    const user = c.get("user");
    const deliveryId = c.req.param("deliveryId");
    const userDb = await getUserDb(user.id);
    const event = await userDb.getWebhookEvent(deliveryId);
    if (!event) return c.json({ ok: false, error: "Webhook event not found" }, 404);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (webhooks as any).receive({
        id: `replay-${randomUUID()}`,
        name: event.eventName,
        payload: event.payload,
      });
      await userDb.updateWebhookEventStatus(deliveryId, "processed");
      return c.json({ ok: true, data: { replayed: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await userDb.updateWebhookEventStatus(deliveryId, "failed", msg);
      return c.json({ ok: false, error: msg }, 500);
    }
  });

  return router;
}
