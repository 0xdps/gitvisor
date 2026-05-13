import type { JobData, SyncWorkflowRunsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listWorkflowRuns, mapWorkflowRun } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";

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

  console.log(`[worker] synced ${workflow_runs.length} runs for ${data.fullName} page ${page}`);

  // If there are more pages, enqueue the next one
  if (workflow_runs.length === 100 && enqueue) {
    const nextPage = page + 1;
    await enqueue({
      type: "sync:workflow-runs",
      data: { ...data, page: nextPage },
    });
  }
}
