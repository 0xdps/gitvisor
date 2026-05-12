import type { Repository, WorkflowRun, SecretMeta, PaginatedResponse } from "@gitvisor/shared";

// Client-side calls use the /api proxy (Next.js rewrites → API service).
// Server-side calls bypass the proxy and hit the API directly.
const API_URL =
  typeof window === "undefined"
    ? (process.env["API_INTERNAL_URL"] ?? "http://localhost:3002")
    : "/api";

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

export function syncRepositories(): Promise<{ queued: number }> {
  return apiFetch<{ queued: number }>("/repositories/sync", { method: "POST" });
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

export function updateSecret(
  repoId: number,
  secretName: string,
  value: string,
): Promise<void> {
  return apiFetch<void>(`/secrets/${repoId}/${encodeURIComponent(secretName)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function deleteSecret(repoId: number, secretName: string): Promise<void> {
  return apiFetch<void>(`/secrets/${repoId}/${encodeURIComponent(secretName)}`, {
    method: "DELETE",
  });
}

// ── Packages ──────────────────────────────────────────────────────────────────

export function getPackages(repositoryId?: string): Promise<import("@gitvisor/shared").Package[]> {
  const qs = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
  return apiFetch(`/packages${qs}`);
}

// ── Profile & Analytics ───────────────────────────────────────────────────────

export interface ProfileStats {
  repositoryCount: number;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  workflowSuccessRate: number | null;
}

export interface Profile {
  userId: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  stats: ProfileStats;
}

export function getProfile(): Promise<Profile> {
  return apiFetch<Profile>("/profile");
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface AuditLogResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  perPage: number;
}

export function getAuditLog(page = 1): Promise<AuditLogResponse> {
  return apiFetch<AuditLogResponse>(`/audit-log?page=${page}&perPage=25`);
}
