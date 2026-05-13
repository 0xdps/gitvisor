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

  // GitHub's account union (User | Enterprise) doesn't always have login/type.
  // This helper normalises both variants into a consistent shape.
  function resolveAccount(account: Record<string, unknown> | null | undefined) {
    return {
      login: (account?.["login"] ?? account?.["slug"] ?? account?.["name"] ?? "") as string,
      type: ((account?.["type"] ?? "Organization") as "User" | "Organization"),
    };
  }

  // ── Installation events ──────────────────────────────────────────────────
  webhooks.on("installation.created", async ({ payload }) => {
    const userId = String(payload.installation.account?.id ?? 0);
    const account = resolveAccount(payload.installation.account as Record<string, unknown>);

    // Persist the installation record first
    await enqueue({
      type: "install:app",
      data: {
        userId,
        githubInstallationId: payload.installation.id,
        accountLogin: account.login,
        accountType: account.type,
        appSlug: payload.installation.app_slug,
        suspended: payload.installation.suspended_at != null,
      },
    });

    // Then fan-out per-repo full syncs
    for (const repo of payload.repositories ?? []) {
      await enqueue({
        type: "sync:repo",
        data: {
          userId,
          installationId: payload.installation.id,
          repositoryId: String(repo.id),
          githubRepoId: repo.id,
          fullName: repo.full_name,
        },
      });
    }
  });

  // ── Repos added to an existing installation ──────────────────────────────
  webhooks.on("installation_repositories.added", async ({ payload }) => {
    const userId = String(payload.installation.account?.id ?? 0);
    const account = resolveAccount(payload.installation.account as Record<string, unknown>);

    // Re-upsert the installation (account may have changed)
    await enqueue({
      type: "install:app",
      data: {
        userId,
        githubInstallationId: payload.installation.id,
        accountLogin: account.login,
        accountType: account.type,
        appSlug: payload.installation.app_slug,
        suspended: payload.installation.suspended_at != null,
      },
    });

    for (const repo of payload.repositories_added ?? []) {
      await enqueue({
        type: "sync:repo",
        data: {
          userId,
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
        userId: String(payload.repository.owner?.id ?? 0),
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
        userId: String(payload.repository.owner?.id ?? 0),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Workflow job events (re-trigger run sync) ────────────────────────────
  webhooks.on("workflow_job", async ({ payload }) => {
    if (!payload.installation) return;
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(payload.repository.owner?.id ?? 0),
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

  // ── Release events (trigger package re-sync) ─────────────────────────────
  webhooks.on("release", async ({ payload }) => {
    if (!payload.installation) return;
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(payload.repository.owner?.id ?? 0),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Installation deleted ─────────────────────────────────────────────────
  webhooks.on("installation.deleted", async ({ payload }) => {
    await enqueue({
      type: "uninstall:app",
      data: {
        githubInstallationId: payload.installation.id,
        userId: String(payload.installation.account?.id ?? 0),
      },
    });
  });

  return webhooks;
}
