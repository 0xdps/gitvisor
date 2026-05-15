import type { SyncReleasesJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listRepoReleases } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("worker");

export async function handleSyncReleases(
  data: SyncReleasesJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner = "", repo = ""] = data.fullName.split("/");
  const releases = await listRepoReleases(octokit as never, owner, repo);
  const userDb = await getUserDb(data.userId);

  for (const r of releases) {
    await userDb.upsertRelease({
      repositoryId: data.repositoryId,
      userId: data.userId,
      githubReleaseId: r.id,
      tagName: r.tag_name,
      name: r.name,
      body: r.body,
      draft: r.draft,
      prerelease: r.prerelease,
      htmlUrl: r.html_url,
      publishedAt: r.published_at,
    });
  }

  log.info({ fullName: data.fullName, count: releases.length }, "sync:releases completed");
}
