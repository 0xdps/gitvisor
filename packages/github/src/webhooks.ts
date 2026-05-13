import { Webhooks } from "@octokit/webhooks";
import type { JobData } from "@gitvisor/shared";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("github");

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
    const accountId = payload.installation.account?.id;
    if (!accountId) {
      log.warn("installation.created: missing account id, skipping");
      return;
    }
    const userId = String(accountId);
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
    const accountId = payload.installation.account?.id;
    if (!accountId) {
      log.warn("installation_repositories.added: missing account id, skipping");
      return;
    }
    const userId = String(accountId);
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
    const ownerId = payload.repository.owner?.id;
    const installId = payload.installation?.id;
    if (!ownerId || !installId) {
      log.warn("workflow_run: missing owner or installation id, skipping");
      return;
    }
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(ownerId),
        installationId: installId,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Push events (trigger workflow run refresh) ───────────────────────────
  webhooks.on("push", async ({ payload }) => {
    if (!payload.installation) return;
    const ownerId = payload.repository.owner?.id;
    if (!ownerId) {
      log.warn("push: missing owner id, skipping");
      return;
    }
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(ownerId),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Workflow job events (re-trigger run sync) ────────────────────────────
  webhooks.on("workflow_job", async ({ payload }) => {
    if (!payload.installation) return;
    const ownerId = payload.repository.owner?.id;
    if (!ownerId) {
      log.warn("workflow_job: missing owner id, skipping");
      return;
    }
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(ownerId),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Package events ───────────────────────────────────────────────────────
  webhooks.on("package", async ({ payload }) => {
    if (!payload.installation) return;
    const ownerId = payload.repository?.owner?.id;
    const repoId = payload.repository?.id;
    if (!ownerId || !repoId) {
      log.warn("package: missing owner or repository id, skipping");
      return;
    }
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(ownerId),
        installationId: payload.installation.id,
        repositoryId: String(repoId),
        fullName: payload.repository?.full_name ?? "",
      },
    });
  });

  // ── Release events (trigger package re-sync) ─────────────────────────────
  webhooks.on("release", async ({ payload }) => {
    if (!payload.installation) return;
    const ownerId = payload.repository.owner?.id;
    if (!ownerId) {
      log.warn("release: missing owner id, skipping");
      return;
    }
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(ownerId),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Repository visibility changes ────────────────────────────────────────
  webhooks.on(["repository.privatized", "repository.publicized"], async ({ payload }) => {
    if (!payload.installation) return;
    const ownerId = payload.repository.owner?.id;
    if (!ownerId) {
      log.warn({ action: payload.action }, "repository event: missing owner id, skipping");
      return;
    }
    await enqueue({
      type: "sync:repo",
      data: {
        userId: String(ownerId),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        githubRepoId: payload.repository.id,
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Installation deleted ─────────────────────────────────────────────────
  webhooks.on("installation.deleted", async ({ payload }) => {
    const accountId = payload.installation.account?.id;
    if (!accountId) {
      log.warn("installation.deleted: missing account id, skipping");
      return;
    }
    await enqueue({
      type: "uninstall:app",
      data: {
        githubInstallationId: payload.installation.id,
        userId: String(accountId),
      },
    });
  });

  return webhooks;
}
