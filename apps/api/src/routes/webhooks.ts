import { Hono } from "hono";
import { createWebhookHandler } from "@gitvisor/github";
import { BullMQQueueRepository } from "@gitvisor/queue";
import { config } from "../config.js";
import type { JobData } from "@gitvisor/shared";

export function createWebhookRouter(queue: BullMQQueueRepository) {
  const router = new Hono();

  const webhooks = createWebhookHandler(
    config.github.webhookSecret,
    async (job: JobData) => {
      await queue.enqueue(job, {
        jobId: `${job.type}:${job.data.repositoryId}:${Date.now()}`,
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

  return router;
}
