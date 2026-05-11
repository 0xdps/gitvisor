import type { Octokit } from "@octokit/rest";
import type { WorkflowRun, WorkflowRunConclusion, WorkflowRunStatus } from "@gitvisor/shared";

export interface GitHubWorkflowRun {
  id: number;
  name: string | null;
  workflow_id: number;
  head_branch: string | null;
  head_sha: string;
  event: string;
  status: string | null;
  conclusion: string | null;
  run_number: number;
  run_attempt?: number | null;
  html_url: string;
  actor: { login: string } | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string | null;
}

export function mapWorkflowRun(
  raw: GitHubWorkflowRun,
  repositoryId: string,
  userId: string,
  workflowName: string,
): Omit<WorkflowRun, "id"> {
  const startedAt = raw.run_started_at ?? null;
  const completedAt = raw.status === "completed" ? raw.updated_at : null;
  const durationMs =
    raw.status === "completed" && startedAt
      ? new Date(raw.updated_at).getTime() - new Date(startedAt).getTime()
      : null;

  return {
    repositoryId,
    userId,
    githubRunId: raw.id,
    workflowName: raw.name ?? workflowName,
    branch: raw.head_branch ?? "",
    commitSha: raw.head_sha,
    status: (raw.status ?? "queued") as WorkflowRunStatus,
    conclusion: (raw.conclusion ?? null) as WorkflowRunConclusion,
    runNumber: raw.run_number,
    runAttempt: raw.run_attempt ?? 1,
    triggeredBy: raw.actor?.login ?? null,
    durationMs,
    htmlUrl: raw.html_url,
    startedAt,
    completedAt,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function listWorkflowRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  page = 1,
  perPage = 100,
) {
  const response = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    per_page: perPage,
    page,
  });
  return response.data;
}

export async function rerunWorkflow(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
) {
  await octokit.rest.actions.reRunWorkflow({ owner, repo, run_id: runId });
}

export async function cancelWorkflowRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
) {
  await octokit.rest.actions.cancelWorkflowRun({ owner, repo, run_id: runId });
}
