// ── User / Auth ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  nubeAuthUserId?: string | null;
}

// ── GitHub App Installation ───────────────────────────────────────────────────

export interface Installation {
  id: string;
  userId: string;
  githubInstallationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  appSlug: string;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export interface Repository {
  id: string;
  installationId: number;
  userId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export type WorkflowRunStatus = "queued" | "in_progress" | "completed";
export type WorkflowRunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | null;

export interface WorkflowRun {
  id: string;
  repositoryId: string;
  userId: string;
  githubRunId: number;
  workflowName: string;
  branch: string;
  commitSha: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion;
  runNumber: number;
  runAttempt: number;
  triggeredBy: string | null;
  durationMs: number | null;
  htmlUrl: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Secret ────────────────────────────────────────────────────────────────────

export type SecretScope = "repo" | "environment" | "org";

export interface SecretMeta {
  id: string;
  repositoryId: string;
  userId?: string;
  name: string;
  scope: SecretScope;
  environment?: string | null;
  githubUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Package ───────────────────────────────────────────────────────────────────

export type PackageEcosystem = "npm" | "docker" | "container" | "maven" | "rubygems" | "nuget";

export interface Package {
  id: string;
  repositoryId: string | null;
  userId?: string;
  githubPackageId: number;
  name: string;
  ecosystem: PackageEcosystem;
  visibility: "public" | "private";
  latestVersion: string | null;
  downloadCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Queue Jobs ────────────────────────────────────────────────────────────────

export interface SyncRepoJobData {
  userId: string;
  installationId: number;
  repositoryId: string;
  githubRepoId: number;
  fullName: string;
}

export interface SyncWorkflowRunsJobData {
  userId: string;
  installationId: number;
  repositoryId: string;
  fullName: string;
  page?: number;
}

export interface SyncSecretsJobData {
  userId: string;
  installationId: number;
  repositoryId: string;
  fullName: string;
}

export interface SyncPackagesJobData {
  userId: string;
  installationId: number;
  repositoryId: string;
  fullName: string;
}

export type JobData =
  | { type: "sync:repo"; data: SyncRepoJobData }
  | { type: "sync:workflow-runs"; data: SyncWorkflowRunsJobData }
  | { type: "sync:secrets"; data: SyncSecretsJobData }
  | { type: "sync:packages"; data: SyncPackagesJobData };

// ── API Response Envelope ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
