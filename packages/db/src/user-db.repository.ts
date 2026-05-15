import type {
  WorkflowRun,
  Workflow,
  SecretMeta,
  Package,
  Repository,
  Release,
  AuditLogEntry,
  WebhookEvent,
  PaginatedResponse,
} from "@gitvisor/shared";

/**
 * User DB — one MesaHub SQLite database per user.
 * All data here is scoped to a single user; no tenant_id needed.
 */
export interface UserDbRepository {
  // Repositories
  upsertRepository(repo: Omit<Repository, "createdAt" | "updatedAt">): Promise<void>;
  getRepository(githubRepoId: number): Promise<Repository | null>;
  listRepositories(): Promise<Repository[]>;
  markRepoSynced(repositoryId: string): Promise<void>;
  /** Cascade-delete a repository and all its related data (workflows, runs, secrets, packages). */
  deleteRepository(githubRepoId: number): Promise<void>;

  // Workflow runs
  upsertWorkflowRun(run: Omit<WorkflowRun, "id"> & { id?: string }): Promise<WorkflowRun>;
  getWorkflowRun(githubRunId: number): Promise<WorkflowRun | null>;
  listWorkflowRuns(opts: {
    repositoryId?: string;
    status?: string;
    workflowName?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<WorkflowRun>>;

  // Secrets (metadata only — no raw values ever stored)
  upsertSecretMeta(secret: Omit<SecretMeta, "id" | "createdAt" | "updatedAt">): Promise<SecretMeta>;
  listSecretMeta(repositoryId?: string): Promise<SecretMeta[]>;
  deleteSecretMeta(repositoryId: string, name: string): Promise<void>;

  // Packages
  upsertPackage(pkg: Omit<Package, "id" | "createdAt" | "updatedAt">): Promise<Package>;
  listPackages(repositoryId?: string): Promise<Package[]>;

  // Releases
  upsertRelease(release: Omit<Release, "id" | "createdAt" | "updatedAt">): Promise<Release>;
  listReleases(opts: { repositoryId?: string; page?: number; perPage?: number }): Promise<PaginatedResponse<Release>>;

  // Workflows (definitions — not runs)
  upsertWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">): Promise<Workflow>;
  listWorkflows(repositoryId: string): Promise<Workflow[]>;

  // Audit log
  appendAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void>;
  listAuditLog(opts: {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<AuditLogEntry>>;

  // Webhook events
  insertWebhookEvent(event: Omit<WebhookEvent, "id" | "receivedAt">): Promise<void>;
  updateWebhookEventStatus(deliveryId: string, status: WebhookEvent["status"], error?: string): Promise<void>;
  getWebhookEvent(deliveryId: string): Promise<WebhookEvent | null>;
  listWebhookEvents(opts: {
    status?: string;
    eventName?: string;
    resourceId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<WebhookEvent>>;

  // Analytics
  getAnalytics(opts: { days?: number }): Promise<{
    byRepo: { repositoryId: string; total: number; success: number; failure: number }[];
    byDay: { date: string; total: number; success: number }[];
  }>;

  // Schema migration
  migrate(): Promise<void>;
}
