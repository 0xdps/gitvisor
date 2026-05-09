import type { SyncSecretsJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listRepoSecrets, mapSecretMeta } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";

export async function handleSyncSecrets(
  data: SyncSecretsJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner, repo] = data.fullName.split("/") as [string, string];
  const userDb = await getUserDb(data.userId);

  const secrets = await listRepoSecrets(octokit as never, owner, repo);

  for (const secret of secrets) {
    const mapped = mapSecretMeta(secret, data.repositoryId, data.userId);
    await userDb.upsertSecretMeta(mapped);
  }

  console.log(`[worker] synced ${secrets.length} secrets for ${data.fullName}`);
}
