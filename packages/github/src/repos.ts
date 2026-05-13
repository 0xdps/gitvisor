import type { Octokit } from "@octokit/rest";

export interface RepoMeta {
  description: string | null;
  language: string | null;
  private: boolean;
  defaultBranch: string;
  stargazersCount: number;
  /** subscribers_count = actual watch count */
  watchersCount: number;
  forksCount: number;
  /** GitHub's open_issues_count includes open PRs */
  openIssuesCount: number;
  pushedAt: string | null;
}

export async function getRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    description: data.description ?? null,
    language: data.language ?? null,
    private: data.private,
    defaultBranch: data.default_branch,
    stargazersCount: data.stargazers_count,
    watchersCount: data.subscribers_count,
    forksCount: data.forks_count,
    openIssuesCount: data.open_issues_count,
    pushedAt: data.pushed_at ?? null,
  };
}

/**
 * Fetches the count of open pull requests via the Link header trick
 * (one request with per_page=1, then read "last" page from Link).
 */
export async function getRepoPullsCount(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<number> {
  const response = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 1,
  });
  const link = response.headers["link"] as string | undefined;
  if (!link) return response.data.length;
  const match = link.match(/[?&]page=(\d+)>; rel="last"/);
  return match?.[1] ? parseInt(match[1], 10) : response.data.length;
}
