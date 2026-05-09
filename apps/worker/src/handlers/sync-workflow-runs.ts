import type { JobData, SyncWorkflowRunsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listWorkflowRuns, mapWorkflowRun } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";

// TODO: inject UserDbRepository once MesaHub implementation is available

export async function handleSyncWorkflowRuns(
  data: SyncWorkflowRunsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
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

  // Queue next page if there are more results
  if (workflow_runs.length === 100) {
    // Next page will be re-enqueued by the caller if needed
    console.log(`[worker] synced ${workflow_runs.length} runs for ${data.fullName} page ${page}`);
  }
}
