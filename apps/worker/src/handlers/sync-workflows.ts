import type { SyncWorkflowsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listWorkflows, mapWorkflow } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";

export async function handleSyncWorkflows(
  data: SyncWorkflowsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner, repo] = data.fullName.split("/") as [string, string];
  const userDb = await getUserDb(data.userId);

  const workflows = await listWorkflows(octokit as never, owner, repo);
  for (const wf of workflows) {
    const mapped = mapWorkflow(wf, data.repositoryId, data.userId);
    await userDb.upsertWorkflow(mapped);
  }

  console.log(`[worker] synced ${workflows.length} workflow(s) for ${data.fullName}`);
}
