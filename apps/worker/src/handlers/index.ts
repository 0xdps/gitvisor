import type { JobData } from "@gitvisor/shared";
import type { UserDbRepository } from "@gitvisor/db";
import { handleSyncWorkflowRuns } from "./sync-workflow-runs.js";
import { handleSyncSecrets } from "./sync-secrets.js";
import { handleSyncPackages } from "./sync-packages.js";

/**
 * Central job dispatcher.
 * Receives a typed job from the queue and routes to the correct handler.
 * getUserDb is injected — implementation provided by the db package.
 */
export async function dispatch(
  job: JobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  switch (job.type) {
    case "sync:repo": {
      const { userId, installationId, repositoryId, githubRepoId, fullName } = job.data;
      const [owner = "", name = ""] = fullName.split("/");

      // Ensure repository record exists in the user's DB before syncing data
      const userDb = await getUserDb(userId);
      await userDb.upsertRepository({
        id: repositoryId,
        githubRepoId,
        installationId,
        userId,
        owner,
        name,
        fullName,
        private: false,
        defaultBranch: "main",
        syncedAt: null,
      });

      // Fan out to sub-handlers in parallel
      await Promise.all([
        handleSyncWorkflowRuns(
          { userId, installationId, repositoryId, fullName },
          getUserDb,
        ),
        handleSyncSecrets(
          { userId, installationId, repositoryId, fullName },
          getUserDb,
        ),
      ]);

      // Mark the repo as synced
      await (await getUserDb(userId)).markRepoSynced(repositoryId);
      console.log(`[worker] sync:repo completed for ${fullName}`);
      break;
    }

    case "sync:workflow-runs":
      await handleSyncWorkflowRuns(job.data, getUserDb);
      break;

    case "sync:secrets":
      await handleSyncSecrets(job.data, getUserDb);
      break;

    case "sync:packages":
      await handleSyncPackages(job.data, getUserDb);
      break;

    default:
      job satisfies never;
  }
}
