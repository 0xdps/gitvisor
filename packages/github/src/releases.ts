import type { Octokit } from "@octokit/rest";

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
  created_at: string;
}

export async function listRepoReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
  perPage = 50,
): Promise<GitHubRelease[]> {
  const { data } = await octokit.rest.repos.listReleases({
    owner,
    repo,
    per_page: perPage,
  });
  return data.map((r) => ({
    id: r.id,
    tag_name: r.tag_name,
    name: r.name ?? null,
    body: r.body ?? null,
    draft: r.draft,
    prerelease: r.prerelease,
    html_url: r.html_url,
    published_at: r.published_at ?? null,
    created_at: r.created_at,
  }));
}
