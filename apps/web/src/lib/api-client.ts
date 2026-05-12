import type { Repository, WorkflowRun, SecretMeta, PaginatedResponse } from "@gitvisor/shared";

const API_URL =
  typeof window === "undefined"
    ? (process.env["API_INTERNAL_URL"] ??
        (import.meta.env["VITE_API_URL"] as string | undefined) ??
        "http://localhost:3002")
    : ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3002");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  const json = (await res.json()) as { ok: true; data: T };
  return json.data;
}

// ── Repositories ─────────────────────────────────────────────────────────────

export function getRepositories(): Promise<Repository[]> {
  return apiFetch<Repository[]>("/repositories");
}

export function getRepository(githubRepoId: number): Promise<Repository> {
  return apiFetch<Repository>(`/repositories/${githubRepoId}`);
}

// ── Workflow Runs ─────────────────────────────────────────────────────────────

export interface WorkflowRunsQuery {
  repositoryId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export function getWorkflowRuns(
  query: WorkflowRunsQuery = {},
): Promise<PaginatedResponse<WorkflowRun>> {
  const params = new URLSearchParams();
  if (query.repositoryId) params.set("repositoryId", query.repositoryId);
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.perPage) params.set("perPage", String(query.perPage));
  const qs = params.toString();
  return apiFetch<PaginatedResponse<WorkflowRun>>(`/workflows${qs ? `?${qs}` : ""}`);
}

export function rerunWorkflow(runId: number): Promise<void> {
  return apiFetch<void>(`/workflows/${runId}/rerun`, { method: "POST" });
}

export function cancelWorkflow(runId: number): Promise<void> {
  return apiFetch<void>(`/workflows/${runId}/cancel`, { method: "POST" });
}

// ── Installations ─────────────────────────────────────────────────────────────

export interface AccountInstallation {
  githubId: number;
  login: string;
  avatarUrl: string | null;
  type: "User" | "Organization";
  installed: boolean;
  installUrl: string;
}

export function getInstallations(): Promise<AccountInstallation[]> {
  return apiFetch<AccountInstallation[]>("/installations");
}

// ── Secrets ───────────────────────────────────────────────────────────────────

export function getSecrets(repositoryId: string): Promise<SecretMeta[]> {
  return apiFetch<SecretMeta[]>(`/secrets?repositoryId=${encodeURIComponent(repositoryId)}`);
}
