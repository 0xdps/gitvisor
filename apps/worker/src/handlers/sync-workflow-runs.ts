import type { JobData, SyncWorkflowRunsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listWorkflowRuns, mapWorkflowRun } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("worker");

export async function handleSyncWorkflowRuns(
  data: SyncWorkflowRunsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  enqueue?: (job: JobData) => Promise<void>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner, repo] = data.fullName.split("/") as [string, string];
  const userDb = await getUserDb(data.userId);

  const page = data.page ?? 1;
  const { workflow_runs } = await listWorkflowRuns(octokit as never, owner, repo, page);

  for (const run of workflow_runs) {
    const mapped = mapWorkflowRun(
      run as never,
      data.repositoryId,
      data.userId,
      run.name ?? "Unknown",
    );
    await userDb.upsertWorkflowRun(mapped);
  }

  log.info({ count: workflow_runs.length, fullName: data.fullName, page }, "workflow runs synced");

  const MAX_SYNC_PAGES = 50;

  // If there are more pages, enqueue the next one (capped to prevent unbounded recursion)
  if (workflow_runs.length === 100 && enqueue) {
    if (page < MAX_SYNC_PAGES) {
      const nextPage = page + 1;
      await enqueue({
        type: "sync:workflow-runs",
        data: { ...data, page: nextPage },
      });
    } else {
      log.warn({ fullName: data.fullName, maxPages: MAX_SYNC_PAGES }, "sync truncated at max pages");
    }
  }
}
