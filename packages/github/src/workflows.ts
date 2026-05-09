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
  const startedAt = raw.run_started_at ?? raw.created_at;
  const updatedAt = raw.updated_at;
  const durationMs =
    raw.status === "completed"
      ? new Date(updatedAt).getTime() - new Date(startedAt).getTime()
      : null;

  return {
    repositoryId,
    userId,
    githubRunId: raw.id,
    workflowId: raw.workflow_id,
    workflowName: raw.name ?? workflowName,
    headBranch: raw.head_branch,
    headSha: raw.head_sha,
    event: raw.event,
    status: (raw.status ?? "queued") as WorkflowRunStatus,
    conclusion: (raw.conclusion ?? null) as WorkflowRunConclusion,
    runNumber: raw.run_number,
    actor: raw.actor?.login ?? null,
    durationMs,
    githubUrl: raw.html_url,
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
