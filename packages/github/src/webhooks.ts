import { Webhooks } from "@octokit/webhooks";
import type { JobData } from "@gitvisor/shared";

export type WebhookJobEnqueuer = (job: JobData) => Promise<void>;

/**
 * Creates and configures the Octokit Webhooks instance.
 * Handlers emit jobs onto the queue — they do not perform DB writes directly.
 */
export function createWebhookHandler(
  secret: string,
  enqueue: WebhookJobEnqueuer,
): Webhooks {
  const webhooks = new Webhooks({ secret });

  // ── Installation events ──────────────────────────────────────────────────
  webhooks.on("installation.created", async ({ payload }) => {
    for (const repo of payload.repositories ?? []) {
      await enqueue({
        type: "sync:repo",
        data: {
          userId: String(payload.installation.account.id),
          installationId: payload.installation.id,
          repositoryId: String(repo.id),
          githubRepoId: repo.id,
          fullName: repo.full_name,
        },
      });
    }
  });

  // ── Workflow run events ──────────────────────────────────────────────────
  webhooks.on("workflow_run", async ({ payload }) => {
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(payload.repository.owner.id),
        installationId: payload.installation?.id ?? 0,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Push events (trigger workflow run refresh) ───────────────────────────
  webhooks.on("push", async ({ payload }) => {
    if (!payload.installation) return;
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(payload.repository.owner.id ?? 0),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Package events ───────────────────────────────────────────────────────
  webhooks.on("package", async ({ payload }) => {
    if (!payload.installation) return;
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(payload.repository?.owner?.id ?? 0),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository?.id ?? 0),
        fullName: payload.repository?.full_name ?? "",
      },
    });
  });

  return webhooks;
}
