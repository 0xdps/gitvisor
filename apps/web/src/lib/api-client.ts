import type { Repository, WorkflowRun, SecretMeta, PaginatedResponse, Release, RepoPullRequest } from "@gitvisor/shared";

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

export function syncRepositories(installationId?: number): Promise<{ queued: number }> {
  return apiFetch<{ queued: number }>("/repositories/sync", {
    method: "POST",
    ...(installationId !== undefined
      ? { body: JSON.stringify({ installationId }) }
      : {}),
  });
}

// ── Workflow Runs ─────────────────────────────────────────────────────────────

export interface WorkflowRunsQuery {
  repositoryId?: string;
  status?: string;
  workflowName?: string;
  page?: number;
  perPage?: number;
}

export function getWorkflowRuns(
  query: WorkflowRunsQuery = {},
): Promise<PaginatedResponse<WorkflowRun>> {
  const params = new URLSearchParams();
  if (query.repositoryId) params.set("repositoryId", query.repositoryId);
  if (query.status) params.set("status", query.status);
  if (query.workflowName) params.set("workflowName", query.workflowName);
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
  /** Cloud only: true when this account type is not included in the user's current plan. */
  locked?: boolean;
}

export function getInstallations(): Promise<AccountInstallation[]> {
  return apiFetch<AccountInstallation[]>("/installations");
}

// ── Secrets ───────────────────────────────────────────────────────────────────

export function getSecrets(repositoryId?: string): Promise<SecretMeta[]> {
  const qs = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
  return apiFetch<SecretMeta[]>(`/secrets${qs}`);
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

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  byRepo: { repositoryId: string; total: number; success: number; failure: number }[];
  byDay: { date: string; total: number; success: number }[];
}

export function getAnalytics(days = 30): Promise<AnalyticsData> {
  return apiFetch<AnalyticsData>(`/analytics?days=${days}`);
}

// ── Releases ──────────────────────────────────────────────────────────────────

export interface ReleasesQuery {
  repositoryId?: string;
  page?: number;
  perPage?: number;
}

export function getReleases(opts: ReleasesQuery = {}): Promise<PaginatedResponse<Release>> {
  const params = new URLSearchParams();
  if (opts.repositoryId) params.set("repositoryId", opts.repositoryId);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.perPage) params.set("perPage", String(opts.perPage));
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Release>>(`/releases${qs ? `?${qs}` : ""}`);
}

export function syncReleases(repositoryId: string): Promise<void> {
  return apiFetch<void>("/releases/sync", {
    method: "POST",
    body: JSON.stringify({ repositoryId }),
  });
}

export type { RepoPullRequest };

// ── Billing (cloud only) ──────────────────────────────────────────────────────────
// These functions are only available when deployed with the cloud API.
// They will throw with a 404 in core deployments — catch and ignore as needed.

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
}

export function getBillingTrialEligibility(): Promise<TrialEligibility> {
  return apiFetch<TrialEligibility>("/billing/trial/eligibility");
}

export function getBillingCheckout(
  planId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId, returnUrl }),
  });
}

export function claimTwitterTrial(): Promise<unknown> {
  return apiFetch("/billing/trial/twitter", { method: "POST" });
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

/**
 * Fetches open pull requests across all tracked repos (live from GitHub).
 * Cached for 2 minutes — stale is acceptable since this is a live proxy.
 */
export function getPullRequests(limit = 50): Promise<RepoPullRequest[]> {
  return apiFetch<RepoPullRequest[]>(`/pull-requests?limit=${limit}`);
}
