import type { JobData } from "@gitvisor/shared";
import type { UserDbRepository, RegistryRepository } from "@gitvisor/db";
import { randomUUID } from "node:crypto";
import { getInstallationOctokit, getRepo, getRepoPullsCount } from "@gitvisor/github";
import { createLogger } from "@gitvisor/logger";
import { handleSyncWorkflowRuns } from "./sync-workflow-runs.js";
import { handleSyncWorkflows } from "./sync-workflows.js";
import { handleSyncSecrets } from "./sync-secrets.js";
import { handleSyncPackages } from "./sync-packages.js";
import { handleSyncReleases } from "./sync-releases.js";

const log = createLogger("worker");

/**
 * Central job dispatcher.
 * Receives a typed job from the queue and routes to the correct handler.
 * getUserDb and registry are injected — implementation provided by the db package.
 */
export async function dispatch(
  job: JobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  registry: RegistryRepository,
  enqueue: (job: JobData) => Promise<void>,
): Promise<void> {
  switch (job.type) {
    case "sync:repo": {
      const { userId, installationId, repositoryId, githubRepoId, fullName } = job.data;
      const [owner = "", name = ""] = fullName.split("/");

      // Fetch real repo metadata from GitHub in parallel with PR count.
      // getRepoPullsCount requires pulls:read permission which the app may not have;
      // fall back to 0 rather than failing the whole job.
      const octokit = await getInstallationOctokit(installationId);
      const [meta, openPullsCount] = await Promise.all([
        getRepo(octokit as never, owner, name),
        getRepoPullsCount(octokit as never, owner, name).catch(() => 0),
      ]);

      // Upsert repo record with real metadata before fanning out
      const userDb = await getUserDb(userId);

      // Capture current state before upsert so we can log meaningful changes
      const existing = await userDb.getRepository(githubRepoId);

      await userDb.upsertRepository({
        id: repositoryId,
        githubRepoId,
        installationId,
        userId,
        owner,
        name,
        fullName,
        private: meta.private,
        archived: meta.archived,
        defaultBranch: meta.defaultBranch,
        description: meta.description,
        language: meta.language,
        stargazersCount: meta.stargazersCount,
        watchersCount: meta.watchersCount,
        forksCount: meta.forksCount,
        openIssuesCount: meta.openIssuesCount,
        openPullsCount,
        pushedAt: meta.pushedAt,
        syncedAt: null,
      });

      // Fan out all sub-syncs in parallel
      await Promise.all([
        handleSyncWorkflowRuns({ userId, installationId, repositoryId, fullName }, getUserDb, enqueue),
        handleSyncWorkflows({ userId, installationId, repositoryId, fullName }, getUserDb),
        handleSyncSecrets({ userId, installationId, repositoryId, fullName }, getUserDb),
        handleSyncPackages({ userId, installationId, repositoryId, fullName }, getUserDb),
      ]);

      // Mark the repo as synced
      await userDb.markRepoSynced(repositoryId);

      // Log meaningful changes to the audit log (visibility, default branch)
      if (!existing) {
        await userDb.appendAuditLog({
          userId,
          action: "repository.synced_first",
          resourceType: "repository",
          resourceId: repositoryId,
          metadata: { fullName, private: meta.private, archived: meta.archived, defaultBranch: meta.defaultBranch },
        });
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (existing && existing.private !== meta.private) {
        changes["private"] = { from: existing.private, to: meta.private };
      }
      if (existing && existing.archived !== meta.archived) {
        changes["archived"] = { from: existing.archived, to: meta.archived };
      }
      if (existing && existing.defaultBranch !== meta.defaultBranch) {
        changes["defaultBranch"] = { from: existing.defaultBranch, to: meta.defaultBranch };
      }
      if (Object.keys(changes).length > 0) {
        await userDb.appendAuditLog({
          userId,
          action: "repository.synced_with_changes",
          resourceType: "repository",
          resourceId: repositoryId,
          metadata: { fullName, changes },
        });
      }

      log.info({ fullName }, "sync:repo completed");
      break;
    }

    case "sync:workflow-runs":
      await handleSyncWorkflowRuns(job.data, getUserDb, enqueue);
      break;

    case "sync:workflows":
      await handleSyncWorkflows(job.data, getUserDb);
      break;

    case "sync:secrets":
      await handleSyncSecrets(job.data, getUserDb);
      break;

    case "sync:packages":
      await handleSyncPackages(job.data, getUserDb);
      break;

    case "sync:releases":
      await handleSyncReleases(job.data, getUserDb);
      break;

    case "uninstall:app": {
      const { githubInstallationId } = job.data;
      await registry.markInstallationUninstalled(githubInstallationId);
      log.info({ githubInstallationId }, "uninstall:app marked as uninstalled");
      break;
    }

    case "install:app": {
      const { userId, githubInstallationId, accountLogin, accountType, appSlug, suspended } = job.data;
      await registry.upsertInstallation({
        id: randomUUID(),
        userId,
        githubInstallationId,
        accountLogin,
        accountType,
        appSlug,
        suspended,
        uninstalledAt: null,
      });
      log.info({ githubInstallationId, userId }, "install:app persisted installation");
      break;
    }

    default:
      job satisfies never;
  }
}
