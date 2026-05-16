import { Webhooks } from "@octokit/webhooks";
import type { JobData } from "@gitvisor/shared";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("github");

export interface WebhookEnqueueOptions {
  delay?: number; // ms before the job becomes available (used to order jobs)
}

export type WebhookJobEnqueuer = (job: JobData, opts?: WebhookEnqueueOptions) => Promise<void>;

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
    // sender.id is the GitHub user who performed the installation, which is
    // always the logged-in user's personal account ID — correct for both
    // personal and org installations.  Using account.id here would store the
    // org's GitHub ID as userId, severing the link to the actual user record.
    const userId = String(payload.sender.id);
    const account = resolveAccount(payload.installation.account as Record<string, unknown>);

    // Persist the installation record first; sync:repo jobs below are delayed
    // 3 s so the install:app job has time to commit before repos start syncing.
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

    // Fan-out per-repo full syncs with a short delay so install:app writes first
    for (const repo of payload.repositories ?? []) {
      await enqueue(
        {
          type: "sync:repo",
          data: {
            userId,
            installationId: payload.installation.id,
            repositoryId: String(repo.id),
            githubRepoId: repo.id,
            fullName: repo.full_name,
          },
        },
        { delay: 3_000 },
      );
    }
  });

  // ── Repos added to an existing installation ──────────────────────────────
  webhooks.on("installation_repositories.added", async ({ payload }) => {
    const userId = String(payload.sender.id);
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
      await enqueue(
        {
          type: "sync:repo",
          data: {
            userId,
            installationId: payload.installation.id,
            repositoryId: String(repo.id),
            githubRepoId: repo.id,
            fullName: repo.full_name,
          },
        },
        { delay: 3_000 },
      );
    }
  });

  // ── Workflow run events ──────────────────────────────────────────────────
  webhooks.on("workflow_run", async ({ payload }) => {
    const installId = payload.installation?.id;
    if (!installId || !payload.sender) {
      log.warn("workflow_run: missing installation id or sender, skipping");
      return;
    }
    // sender.id is the user who triggered the run; for org repos this is the
    // actual user, not the org's account ID.
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(payload.sender.id),
        installationId: installId,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Push events (trigger workflow run refresh on default branch only) ────
  webhooks.on("push", async ({ payload }) => {
    if (!payload.installation || !payload.sender) return;
    // Ignore pushes to non-default branches to avoid excessive job volume.
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) return;
    await enqueue({
      type: "sync:workflow-runs",
      data: {
        userId: String(payload.sender.id),
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
        userId: String(payload.sender.id),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Package events ───────────────────────────────────────────────────────
  webhooks.on("package", async ({ payload }) => {
    if (!payload.installation) return;
    const repoId = payload.repository?.id;
    if (!repoId) {
      log.warn("package: missing repository id, skipping");
      return;
    }
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(payload.sender.id),
        installationId: payload.installation.id,
        repositoryId: String(repoId),
        fullName: payload.repository?.full_name ?? "",
      },
    });
  });

  // ── Release events (trigger package re-sync) ─────────────────────────────
  webhooks.on("release", async ({ payload }) => {
    if (!payload.installation || !payload.sender) return;
    await enqueue({
      type: "sync:packages",
      data: {
        userId: String(payload.sender.id),
        installationId: payload.installation.id,
        repositoryId: String(payload.repository.id),
        fullName: payload.repository.full_name,
      },
    });
  });

  // ── Repository events ────────────────────────────────────────────────────
  // renamed: GitHub sends the updated full_name so enqueueing sync:repo
  // overwrites the stale name in the DB automatically.
  webhooks.on(
    ["repository.privatized", "repository.publicized", "repository.renamed"],
    async ({ payload }) => {
      if (!payload.installation) return;
      await enqueue({
        type: "sync:repo",
        data: {
          userId: String(payload.sender.id),
          installationId: payload.installation.id,
          repositoryId: String(payload.repository.id),
          githubRepoId: payload.repository.id,
          fullName: payload.repository.full_name,
        },
      });
    },
  );

  // deleted: remove from DB so stale data doesn't persist on the dashboard
  webhooks.on("repository.deleted", async ({ payload }) => {
    if (!payload.installation) return;
    await enqueue({
      type: "delete:repo",
      data: {
        userId: String(payload.sender.id),
        installationId: payload.installation.id,
        githubRepoId: payload.repository.id,
      },
    });
  });

  // ── Installation suspended / unsuspended ─────────────────────────────────
  webhooks.on("installation.suspend", async ({ payload }) => {
    const account = resolveAccount(payload.installation.account as Record<string, unknown>);
    await enqueue({
      type: "install:app",
      data: {
        userId: String(payload.sender.id),
        githubInstallationId: payload.installation.id,
        accountLogin: account.login,
        accountType: account.type,
        appSlug: payload.installation.app_slug,
        suspended: true,
      },
    });
  });

  webhooks.on("installation.unsuspend", async ({ payload }) => {
    const account = resolveAccount(payload.installation.account as Record<string, unknown>);
    await enqueue({
      type: "install:app",
      data: {
        userId: String(payload.sender.id),
        githubInstallationId: payload.installation.id,
        accountLogin: account.login,
        accountType: account.type,
        appSlug: payload.installation.app_slug,
        suspended: false,
      },
    });
  });

  // ── Installation deleted ─────────────────────────────────────────────────
  webhooks.on("installation.deleted", async ({ payload }) => {
    await enqueue({
      type: "uninstall:app",
      data: {
        githubInstallationId: payload.installation.id,
        userId: String(payload.sender.id),
      },
    });
  });

  return webhooks;
}
