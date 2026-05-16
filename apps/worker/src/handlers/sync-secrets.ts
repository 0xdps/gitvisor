import type { SyncSecretsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listRepoSecrets, mapSecretMeta } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";
import { getGitHubErrorStatus, isExpectedGitHubError } from "./github-errors.js";

const log = createLogger("worker");

export async function handleSyncSecrets(
  data: SyncSecretsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner, repo] = data.fullName.split("/") as [string, string];
  const userDb = await getUserDb(data.userId);

  let secrets: Array<{ name: string; created_at: string; updated_at: string }> = [];
  try {
    secrets = await listRepoSecrets(octokit as never, owner, repo);
  } catch (err) {
    if (isExpectedGitHubError(err, [403, 404])) {
      log.info(
        { fullName: data.fullName, status: getGitHubErrorStatus(err) },
        "secrets sync skipped due to missing permission or unavailable endpoint",
      );
      return;
    }
    throw err;
  }

  for (const secret of secrets) {
    const mapped = mapSecretMeta(secret, data.repositoryId, data.userId);
    await userDb.upsertSecretMeta(mapped);
  }

  log.info({ count: secrets.length, fullName: data.fullName }, "secrets synced");
}
