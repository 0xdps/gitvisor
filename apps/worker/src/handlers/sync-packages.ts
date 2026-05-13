import type { SyncPackagesJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listPackages, mapPackage, SUPPORTED_ECOSYSTEMS } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("worker");

export async function handleSyncPackages(
  data: SyncPackagesJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner = ""] = data.fullName.split("/");
  const userDb = await getUserDb(data.userId);

  for (const ecosystem of SUPPORTED_ECOSYSTEMS) {
    try {
      const pkgs = await listPackages(octokit as never, owner, ecosystem);
      for (const pkg of pkgs) {
        const mapped = mapPackage(pkg as never, data.repositoryId, data.userId);
        await userDb.upsertPackage({ ...mapped, latestVersion: null });
      }
      if (pkgs.length > 0) {
        log.info({ count: pkgs.length, ecosystem, owner }, "packages synced");
      }
    } catch {
      // Not all ecosystems are available for every account — swallow 404/403
    }
  }

  log.info({ fullName: data.fullName }, "sync:packages completed");
}
