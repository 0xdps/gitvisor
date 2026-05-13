import type { JobData } from "@gitvisor/shared";
import type { UserDbRepository, RegistryRepository } from "@gitvisor/db";
import { getInstallationOctokit, getRepo, getRepoPullsCount } from "@gitvisor/github";
import { handleSyncWorkflowRuns } from "./sync-workflow-runs.js";
import { handleSyncWorkflows } from "./sync-workflows.js";
import { handleSyncSecrets } from "./sync-secrets.js";
import { handleSyncPackages } from "./sync-packages.js";

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

      // Fetch real repo metadata from GitHub in parallel with PR count
      const octokit = await getInstallationOctokit(installationId);
      const [meta, openPullsCount] = await Promise.all([
        getRepo(octokit as never, owner, name),
        getRepoPullsCount(octokit as never, owner, name),
      ]);

      // Upsert repo record with real metadata before fanning out
      const userDb = await getUserDb(userId);
      await userDb.upsertRepository({
        id: repositoryId,
        githubRepoId,
        installationId,
        userId,
        owner,
        name,
        fullName,
        private: meta.private,
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
      await (await getUserDb(userId)).markRepoSynced(repositoryId);
      console.log(`[worker] sync:repo completed for ${fullName}`);
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

    case "uninstall:app": {
      const { githubInstallationId } = job.data;
      await registry.markInstallationUninstalled(githubInstallationId);
      console.log(`[worker] uninstall:app marked installation ${githubInstallationId} as uninstalled`);
      break;
    }

    default:
      job satisfies never;
  }
}
