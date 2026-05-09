import type { JobData } from "@gitvisor/shared";
import type { UserDbRepository } from "@gitvisor/db";
import { handleSyncWorkflowRuns } from "./sync-workflow-runs.js";
import { handleSyncSecrets } from "./sync-secrets.js";

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
    case "sync:repo":
      // Triggers sub-jobs for workflow runs, secrets, packages
      // TODO: implement full repo sync once UserDbRepository is wired
      console.log(`[worker] sync:repo ${job.data.fullName}`);
      break;

    case "sync:workflow-runs":
      await handleSyncWorkflowRuns(job.data, getUserDb);
      break;

    case "sync:secrets":
      await handleSyncSecrets(job.data, getUserDb);
      break;

    case "sync:packages":
      // TODO: implement once packages handler is added
      console.log(`[worker] sync:packages ${job.data.fullName}`);
      break;

    default:
      job satisfies never;
  }
}
