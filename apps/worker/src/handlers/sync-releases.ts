import type { SyncReleasesJobData } from "@gitvisor/shared";
import { getInstallationOctokit, listRepoReleases } from "@gitvisor/github";
import type { UserDbRepository } from "@gitvisor/db";
import { createLogger } from "@gitvisor/logger";
import { getGitHubErrorStatus, isExpectedGitHubError } from "./github-errors.js";

const log = createLogger("worker");

export async function handleSyncReleases(
  data: SyncReleasesJobData,
  getUserDb: (userId: string) => Promise<UserDbRepository>,
): Promise<void> {
  const octokit = await getInstallationOctokit(data.installationId);
  const [owner = "", repo = ""] = data.fullName.split("/");
  let releases: Awaited<ReturnType<typeof listRepoReleases>> = [];
  try {
    releases = await listRepoReleases(octokit as never, owner, repo);
  } catch (err) {
    if (isExpectedGitHubError(err, [403, 404])) {
      log.info(
        { fullName: data.fullName, status: getGitHubErrorStatus(err) },
        "releases sync skipped due to missing permission or unavailable endpoint",
      );
      return;
    }
    throw err;
  }
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
