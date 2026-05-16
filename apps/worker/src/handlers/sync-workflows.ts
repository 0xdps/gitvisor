import type { SyncWorkflowsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listWorkflows, mapWorkflow } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";
import { getGitHubErrorStatus, isExpectedGitHubError } from "./github-errors.js";

const log = createLogger("worker");

export async function handleSyncWorkflows(
  data: SyncWorkflowsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner, repo] = data.fullName.split("/") as [string, string];
  const userDb = await getUserDb(data.userId);

  let workflows: Awaited<ReturnType<typeof listWorkflows>> = [];
  try {
    workflows = await listWorkflows(octokit as never, owner, repo);
  } catch (err) {
    if (isExpectedGitHubError(err, [403, 404])) {
      log.info(
        { fullName: data.fullName, status: getGitHubErrorStatus(err) },
        "workflows sync skipped due to missing Actions access or unavailable endpoint",
      );
      return;
    }
    throw err;
  }
  for (const wf of workflows) {
    const mapped = mapWorkflow(wf, data.repositoryId, data.userId);
    await userDb.upsertWorkflow(mapped);
  }

  log.info({ count: workflows.length, fullName: data.fullName }, "workflows synced");
}
