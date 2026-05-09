import type {
  WorkflowRun,
  SecretMeta,
  Package,
  Repository,
  AuditLogEntry,
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

  // Workflow runs
  upsertWorkflowRun(run: Omit<WorkflowRun, "id"> & { id?: string }): Promise<WorkflowRun>;
  getWorkflowRun(githubRunId: number): Promise<WorkflowRun | null>;
  listWorkflowRuns(opts: {
    repositoryId?: string;
    status?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<WorkflowRun>>;

  // Secrets (metadata only — no raw values ever stored)
  upsertSecretMeta(secret: Omit<SecretMeta, "id" | "createdAt" | "updatedAt">): Promise<SecretMeta>;
  listSecretMeta(repositoryId: string): Promise<SecretMeta[]>;
  deleteSecretMeta(repositoryId: string, name: string): Promise<void>;

  // Packages
  upsertPackage(pkg: Omit<Package, "id" | "createdAt" | "updatedAt">): Promise<Package>;
  listPackages(repositoryId?: string): Promise<Package[]>;

  // Audit log
  appendAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void>;
  listAuditLog(opts: { page?: number; perPage?: number }): Promise<PaginatedResponse<AuditLogEntry>>;

  // Schema migration
  migrate(): Promise<void>;
}
