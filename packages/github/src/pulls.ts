import type { Octokit } from "@octokit/rest";
import type { PullRequestSummary } from "@gitvisor/shared";

/**
 * Fetches open pull requests for a single repository.
 * Results are sorted by updatedAt descending (most recently active first).
 *
 * We intentionally keep the payload lean — only fields needed for the
 * cross-repo overview. For detailed PR data (diffs, reviews, checks) the
 * consumer should fetch directly from GitHub.
 */
export async function listOpenPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  perPage = 25,
): Promise<PullRequestSummary[]> {
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: perPage,
    sort: "updated",
    direction: "desc",
  });

  return data.map((pr) => {
    // NOTE: `comments` and `review_comments` (counts) ARE returned by the GitHub
    // API v3 but are not included in the @octokit/rest TypeScript type for
    // pulls.list. Cast to access them safely at runtime.
    const raw = pr as typeof pr & { comments?: number; review_comments?: number };
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      draft: pr.draft ?? false,
      authorLogin: pr.user?.login ?? "unknown",
      authorAvatarUrl: pr.user?.avatar_url ?? null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      htmlUrl: pr.html_url,
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
      commentsCount: (raw.comments ?? 0) + (raw.review_comments ?? 0),
      requestedReviewersCount: pr.requested_reviewers?.length ?? 0,
    };
  });
}
