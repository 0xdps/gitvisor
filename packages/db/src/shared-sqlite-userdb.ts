import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { UserDbRepository } from "./user-db.repository.js";
import type {
  WorkflowRun,
  Workflow,
  SecretMeta,
  Package,
  Repository,
  AuditLogEntry,
  PaginatedResponse,
} from "@gitvisor/shared";

/**
 * UserDbRepository backed by a single shared SQLite file.
 * Used by the OSS core — all users on an instance share the same database.
 * The userId is still stored in every row for ownership semantics.
 */
export class SharedSqliteUserDbRepository implements UserDbRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  migrate(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        github_repo_id INTEGER UNIQUE NOT NULL,
        installation_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        private INTEGER NOT NULL DEFAULT 0,
        default_branch TEXT NOT NULL DEFAULT 'main',
        description TEXT,
        language TEXT,
        stargazers_count INTEGER NOT NULL DEFAULT 0,
        watchers_count INTEGER NOT NULL DEFAULT 0,
        forks_count INTEGER NOT NULL DEFAULT 0,
        open_issues_count INTEGER NOT NULL DEFAULT 0,
        open_pulls_count INTEGER NOT NULL DEFAULT 0,
        pushed_at TEXT,
        synced_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        github_workflow_id INTEGER UNIQUE NOT NULL,
        repository_id TEXT NOT NULL REFERENCES repositories(id),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        state TEXT NOT NULL,
        html_url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_workflows_repository_id ON workflows(repository_id);

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        github_run_id INTEGER UNIQUE NOT NULL,
        repository_id TEXT NOT NULL REFERENCES repositories(id),
        user_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        status TEXT NOT NULL,
        conclusion TEXT,
        branch TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        run_number INTEGER NOT NULL,
        run_attempt INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER,
        triggered_by TEXT,
        html_url TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_repository_id ON workflow_runs(repository_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

      CREATE TABLE IF NOT EXISTS secret_meta (
        id TEXT PRIMARY KEY,
        repository_id TEXT NOT NULL REFERENCES repositories(id),
        user_id TEXT,
        name TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'repo',
        environment TEXT,
        github_updated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(repository_id, name)
      );

      CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY,
        repository_id TEXT REFERENCES repositories(id),
        user_id TEXT,
        github_package_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        ecosystem TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        latest_version TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
    `);
    return Promise.resolve();
  }

  // ── Repositories ──────────────────────────────────────────────────────────

  upsertRepository(repo: Omit<Repository, "createdAt" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO repositories (
           id, github_repo_id, installation_id, user_id, full_name, private, default_branch,
           description, language, stargazers_count, watchers_count, forks_count,
           open_issues_count, open_pulls_count, pushed_at, synced_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_repo_id) DO UPDATE SET
           full_name         = excluded.full_name,
           private           = excluded.private,
           default_branch    = excluded.default_branch,
           description       = excluded.description,
           language          = excluded.language,
           stargazers_count  = excluded.stargazers_count,
           watchers_count    = excluded.watchers_count,
           forks_count       = excluded.forks_count,
           open_issues_count = excluded.open_issues_count,
           open_pulls_count  = excluded.open_pulls_count,
           pushed_at         = excluded.pushed_at,
           updated_at        = excluded.updated_at`,
      )
      .run(
        repo.id,
        repo.githubRepoId,
        repo.installationId,
        repo.userId,
        repo.fullName,
        repo.private ? 1 : 0,
        repo.defaultBranch,
        repo.description ?? null,
        repo.language ?? null,
        repo.stargazersCount ?? 0,
        repo.watchersCount ?? 0,
        repo.forksCount ?? 0,
        repo.openIssuesCount ?? 0,
        repo.openPullsCount ?? 0,
        repo.pushedAt ?? null,
        repo.syncedAt ?? null,
        now,
        now,
      );
    return Promise.resolve();
  }

  getRepository(githubRepoId: number): Promise<Repository | null> {
    const row = this.db
      .prepare(`SELECT * FROM repositories WHERE github_repo_id = ? LIMIT 1`)
      .get(githubRepoId) as Record<string, unknown> | undefined;
    return Promise.resolve(row ? this.mapRepository(row) : null);
  }

  listRepositories(): Promise<Repository[]> {
    const rows = this.db
      .prepare(`SELECT * FROM repositories ORDER BY full_name ASC`)
      .all() as Record<string, unknown>[];
    return Promise.resolve(rows.map((r) => this.mapRepository(r)));
  }

  markRepoSynced(repositoryId: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE repositories SET synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      )
      .run(repositoryId);
    return Promise.resolve();
  }

  private mapRepository(row: Record<string, unknown>): Repository {
    const fullName = row["full_name"] as string;
    const [owner = "", name = ""] = fullName.split("/");
    return {
      id: row["id"] as string,
      githubRepoId: row["github_repo_id"] as number,
      installationId: row["installation_id"] as number,
      userId: row["user_id"] as string,
      owner,
      name,
      fullName,
      private: (row["private"] as number) === 1,
      defaultBranch: row["default_branch"] as string,
      description: (row["description"] as string | null) ?? null,
      language: (row["language"] as string | null) ?? null,
      stargazersCount: (row["stargazers_count"] as number) ?? 0,
      watchersCount: (row["watchers_count"] as number) ?? 0,
      forksCount: (row["forks_count"] as number) ?? 0,
      openIssuesCount: (row["open_issues_count"] as number) ?? 0,
      openPullsCount: (row["open_pulls_count"] as number) ?? 0,
      pushedAt: (row["pushed_at"] as string | null) ?? null,
      syncedAt: (row["synced_at"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      updatedAt: row["updated_at"] as string,
    };
  }

  // ── Workflow Runs ──────────────────────────────────────────────────────────

  upsertWorkflowRun(run: Omit<WorkflowRun, "id"> & { id?: string }): Promise<WorkflowRun> {
    const id = run.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflow_runs (
           id, github_run_id, repository_id, user_id, workflow_name, status, conclusion,
           branch, commit_sha, run_number, run_attempt, duration_ms, triggered_by,
           html_url, started_at, completed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_run_id) DO UPDATE SET
           status       = excluded.status,
           conclusion   = excluded.conclusion,
           duration_ms  = excluded.duration_ms,
           completed_at = excluded.completed_at,
           updated_at   = excluded.updated_at`,
      )
      .run(
        id,
        run.githubRunId,
        run.repositoryId,
        run.userId,
        run.workflowName,
        run.status,
        run.conclusion ?? null,
        run.branch,
        run.commitSha,
        run.runNumber,
        run.runAttempt,
        run.durationMs ?? null,
        run.triggeredBy ?? null,
        run.htmlUrl,
        run.startedAt ?? null,
        run.completedAt ?? null,
        now,
        now,
      );
    return Promise.resolve({ ...run, id });
  }

  getWorkflowRun(githubRunId: number): Promise<WorkflowRun | null> {
    const row = this.db
      .prepare(`SELECT * FROM workflow_runs WHERE github_run_id = ? LIMIT 1`)
      .get(githubRunId) as Record<string, unknown> | undefined;
    return Promise.resolve(row ? this.mapWorkflowRun(row) : null);
  }

  listWorkflowRuns(opts: {
    repositoryId?: string;
    status?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<WorkflowRun>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 25;
    const offset = (page - 1) * perPage;

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (opts.repositoryId) { conditions.push("repository_id = ?"); params.push(opts.repositoryId); }
    if (opts.status) { conditions.push("status = ?"); params.push(opts.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM workflow_runs ${where}`)
      .get(...params) as { total: number } | undefined;
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare(`SELECT * FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
      .all(...params, perPage, offset) as Record<string, unknown>[];

    return Promise.resolve({
      items: rows.map((r) => this.mapWorkflowRun(r)),
      total,
      page,
      perPage,
      hasMore: total > page * perPage,
    });
  }

  private mapWorkflowRun(row: Record<string, unknown>): WorkflowRun {
    return {
      id: row["id"] as string,
      githubRunId: row["github_run_id"] as number,
      repositoryId: row["repository_id"] as string,
      userId: row["user_id"] as string,
      workflowName: row["workflow_name"] as string,
      status: row["status"] as WorkflowRun["status"],
      conclusion: (row["conclusion"] as WorkflowRun["conclusion"]) ?? null,
      branch: row["branch"] as string,
      commitSha: row["commit_sha"] as string,
      runNumber: row["run_number"] as number,
      runAttempt: row["run_attempt"] as number,
      durationMs: (row["duration_ms"] as number | null) ?? null,
      triggeredBy: (row["triggered_by"] as string | null) ?? null,
      htmlUrl: row["html_url"] as string,
      startedAt: (row["started_at"] as string | null) ?? null,
      completedAt: (row["completed_at"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      updatedAt: row["updated_at"] as string,
    };
  }

  // ── Secrets (metadata only — raw values never stored) ─────────────────────

  upsertSecretMeta(secret: Omit<SecretMeta, "id" | "createdAt" | "updatedAt">): Promise<SecretMeta> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO secret_meta (id, repository_id, user_id, name, scope, environment, github_updated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(repository_id, name) DO UPDATE SET
           scope              = excluded.scope,
           environment        = excluded.environment,
           github_updated_at  = excluded.github_updated_at,
           updated_at         = excluded.updated_at`,
      )
      .run(
        id,
        secret.repositoryId,
        secret.userId ?? null,
        secret.name,
        secret.scope,
        secret.environment ?? null,
        secret.githubUpdatedAt ?? null,
        now,
        now,
      );
    return Promise.resolve({ id, ...secret, createdAt: now, updatedAt: now } as SecretMeta);
  }

  listSecretMeta(repositoryId: string): Promise<SecretMeta[]> {
    const rows = this.db
      .prepare(`SELECT * FROM secret_meta WHERE repository_id = ? ORDER BY name ASC`)
      .all(repositoryId) as Record<string, unknown>[];
    return Promise.resolve(
      rows.map((row) => {
        const userId = row["user_id"] as string | null;
        return {
          id: row["id"] as string,
          repositoryId: row["repository_id"] as string,
          ...(userId != null ? { userId } : {}),
          name: row["name"] as string,
          scope: row["scope"] as SecretMeta["scope"],
          environment: (row["environment"] as string | null) ?? null,
          githubUpdatedAt: (row["github_updated_at"] as string | null) ?? null,
          createdAt: row["created_at"] as string,
          updatedAt: row["updated_at"] as string,
        };
      }),
    );
  }

  deleteSecretMeta(repositoryId: string, name: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM secret_meta WHERE repository_id = ? AND name = ?`)
      .run(repositoryId, name);
    return Promise.resolve();
  }

  // ── Packages ──────────────────────────────────────────────────────────────

  upsertPackage(pkg: Omit<Package, "id" | "createdAt" | "updatedAt">): Promise<Package> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO packages (id, repository_id, user_id, github_package_id, name, ecosystem, visibility, latest_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_package_id) DO UPDATE SET
           name           = excluded.name,
           visibility     = excluded.visibility,
           latest_version = excluded.latest_version,
           updated_at     = excluded.updated_at`,
      )
      .run(
        id,
        pkg.repositoryId ?? null,
        pkg.userId ?? null,
        pkg.githubPackageId,
        pkg.name,
        pkg.ecosystem,
        pkg.visibility,
        pkg.latestVersion ?? null,
        now,
        now,
      );
    return Promise.resolve({ id, ...pkg, createdAt: now, updatedAt: now } as Package);
  }

  listPackages(repositoryId?: string): Promise<Package[]> {
    const rows = (
      repositoryId
        ? this.db
            .prepare(`SELECT * FROM packages WHERE repository_id = ? ORDER BY name ASC`)
            .all(repositoryId)
        : this.db.prepare(`SELECT * FROM packages ORDER BY name ASC`).all()
    ) as Record<string, unknown>[];
    return Promise.resolve(
      rows.map((row) => {
        const userId = row["user_id"] as string | null;
        return {
          id: row["id"] as string,
          repositoryId: (row["repository_id"] as string | null) ?? null,
          ...(userId != null ? { userId } : {}),
          githubPackageId: row["github_package_id"] as number,
          name: row["name"] as string,
          ecosystem: row["ecosystem"] as Package["ecosystem"],
          visibility: row["visibility"] as Package["visibility"],
          latestVersion: (row["latest_version"] as string | null) ?? null,
          createdAt: row["created_at"] as string,
          updatedAt: row["updated_at"] as string,
        };
      }),
    );
  }

  // ── Workflows (definitions) ───────────────────────────────────────────────

  upsertWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">): Promise<Workflow> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflows (id, github_workflow_id, repository_id, user_id, name, path, state, html_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_workflow_id) DO UPDATE SET
           name       = excluded.name,
           path       = excluded.path,
           state      = excluded.state,
           html_url   = excluded.html_url,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        workflow.githubWorkflowId,
        workflow.repositoryId,
        workflow.userId,
        workflow.name,
        workflow.path,
        workflow.state,
        workflow.htmlUrl,
        now,
        now,
      );
    return Promise.resolve({ id, ...workflow, createdAt: now, updatedAt: now });
  }

  listWorkflows(repositoryId: string): Promise<Workflow[]> {
    const rows = this.db
      .prepare(`SELECT * FROM workflows WHERE repository_id = ? ORDER BY name ASC`)
      .all(repositoryId) as Record<string, unknown>[];
    return Promise.resolve(
      rows.map((row) => ({
        id: row["id"] as string,
        repositoryId: row["repository_id"] as string,
        userId: row["user_id"] as string,
        githubWorkflowId: row["github_workflow_id"] as number,
        name: row["name"] as string,
        path: row["path"] as string,
        state: row["state"] as string,
        htmlUrl: row["html_url"] as string,
        createdAt: row["created_at"] as string,
        updatedAt: row["updated_at"] as string,
      })),
    );
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────

  appendAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        randomUUID(),
        entry.userId,
        entry.action,
        entry.resourceType,
        entry.resourceId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      );
    return Promise.resolve();
  }

  listAuditLog(opts: { page?: number; perPage?: number }): Promise<PaginatedResponse<AuditLogEntry>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 50;
    const offset = (page - 1) * perPage;

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM audit_log`)
      .get() as { total: number } | undefined;
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(perPage, offset) as Record<string, unknown>[];

    return Promise.resolve({
      items: rows.map((row) => ({
        id: row["id"] as string,
        userId: row["user_id"] as string,
        action: row["action"] as string,
        resourceType: row["resource_type"] as string,
        resourceId: (row["resource_id"] as string | null) ?? null,
        metadata: row["metadata"]
          ? (JSON.parse(row["metadata"] as string) as Record<string, unknown>)
          : {},
        createdAt: row["created_at"] as string,
      })),
      total,
      page,
      perPage,
      hasMore: total > page * perPage,
    });
  }
}

/**
 * Creates a SharedSqliteUserDbRepository and runs migrations.
 * Returns the ready-to-use repository.
 */
export async function createSharedSqliteUserDb(
  path: string,
): Promise<SharedSqliteUserDbRepository> {
  const userDb = new SharedSqliteUserDbRepository(path);
  await userDb.migrate();
  return userDb;
}
