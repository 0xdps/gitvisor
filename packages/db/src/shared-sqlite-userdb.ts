import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { UserDbRepository } from "./user-db.repository.js";
import type {
  WorkflowRun,
  Workflow,
  SecretMeta,
  SecretGroup,
  Package,
  Repository,
  Release,
  AuditLogEntry,
  WebhookEvent,
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
        archived INTEGER NOT NULL DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        delivery_id TEXT UNIQUE NOT NULL,
        event_name TEXT NOT NULL,
        action TEXT,
        installation_id INTEGER,
        resource_type TEXT,
        resource_id TEXT,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'received',
        error TEXT,
        received_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        github_release_id INTEGER NOT NULL,
        tag_name TEXT NOT NULL,
        name TEXT,
        body TEXT,
        draft INTEGER NOT NULL DEFAULT 0,
        prerelease INTEGER NOT NULL DEFAULT 0,
        html_url TEXT NOT NULL,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(repository_id, github_release_id)
      );
      CREATE INDEX IF NOT EXISTS idx_releases_repository_id ON releases(repository_id);
      CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases(published_at DESC);

      CREATE TABLE IF NOT EXISTS secret_groups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        secret_names TEXT NOT NULL DEFAULT '[]',
        last_rotated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS secret_group_repos (
        group_id TEXT NOT NULL REFERENCES secret_groups(id) ON DELETE CASCADE,
        repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, repository_id)
      );
      CREATE INDEX IF NOT EXISTS idx_secret_group_repos_group_id ON secret_group_repos(group_id);
    `);
    return Promise.resolve();
  }

  // ── Repositories ──────────────────────────────────────────────────────────

  upsertRepository(repo: Omit<Repository, "createdAt" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO repositories (
           id, github_repo_id, installation_id, user_id, full_name, private, archived, default_branch,
           description, language, stargazers_count, watchers_count, forks_count,
           open_issues_count, open_pulls_count, pushed_at, synced_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_repo_id) DO UPDATE SET
           full_name         = excluded.full_name,
           private           = excluded.private,
           archived          = excluded.archived,
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
        repo.archived ? 1 : 0,
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

  deleteRepository(githubRepoId: number): Promise<void> {
    this.db.transaction(() => {
      const repo = this.db
        .prepare(`SELECT id FROM repositories WHERE github_repo_id = ? LIMIT 1`)
        .get(githubRepoId) as { id: string } | undefined;
      if (!repo) return;
      // Delete child rows first (foreign_keys = ON prevents deleting the parent otherwise)
      this.db.prepare(`DELETE FROM workflow_runs WHERE repository_id = ?`).run(repo.id);
      this.db.prepare(`DELETE FROM workflows WHERE repository_id = ?`).run(repo.id);
      this.db.prepare(`DELETE FROM secret_meta WHERE repository_id = ?`).run(repo.id);
      this.db.prepare(`DELETE FROM packages WHERE repository_id = ?`).run(repo.id);
      this.db.prepare(`DELETE FROM repositories WHERE id = ?`).run(repo.id);
    })();
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
      archived: (row["archived"] as number) === 1,
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
    workflowName?: string;
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
    if (opts.workflowName) { conditions.push("LOWER(workflow_name) LIKE ?"); params.push(`%${opts.workflowName.toLowerCase()}%`); }

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

  listSecretMeta(repositoryId?: string): Promise<SecretMeta[]> {
    const rows = repositoryId
      ? (this.db
          .prepare(`SELECT * FROM secret_meta WHERE repository_id = ? ORDER BY name ASC`)
          .all(repositoryId) as Record<string, unknown>[])
      : (this.db
          .prepare(`SELECT * FROM secret_meta ORDER BY name ASC`)
          .all() as Record<string, unknown>[]);
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

  // ── Secret Groups ──────────────────────────────────────────────────────────

  private mapSecretGroup(row: Record<string, unknown>, repoIds: string[]): SecretGroup {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      secretNames: JSON.parse(row.secret_names as string) as string[],
      repoIds,
      lastRotatedAt: (row.last_rotated_at as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private getGroupRepoIds(groupId: string): string[] {
    return (
      this.db
        .prepare(`SELECT repository_id FROM secret_group_repos WHERE group_id = ?`)
        .all(groupId) as { repository_id: string }[]
    ).map((r) => r.repository_id);
  }

  listSecretGroups(): Promise<SecretGroup[]> {
    const rows = this.db
      .prepare(`SELECT * FROM secret_groups ORDER BY name ASC`)
      .all() as Record<string, unknown>[];
    return Promise.resolve(
      rows.map((row) => this.mapSecretGroup(row, this.getGroupRepoIds(row.id as string))),
    );
  }

  getSecretGroup(groupId: string): Promise<SecretGroup | null> {
    const row = this.db
      .prepare(`SELECT * FROM secret_groups WHERE id = ? LIMIT 1`)
      .get(groupId) as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapSecretGroup(row, this.getGroupRepoIds(groupId)));
  }

  createSecretGroup(
    group: Omit<SecretGroup, "id" | "createdAt" | "updatedAt" | "lastRotatedAt">,
  ): Promise<SecretGroup> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO secret_groups (id, user_id, name, description, secret_names, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, group.userId, group.name, group.description ?? null, JSON.stringify(group.secretNames), now, now);
      for (const repoId of group.repoIds) {
        this.db
          .prepare(`INSERT OR IGNORE INTO secret_group_repos (group_id, repository_id) VALUES (?, ?)`)
          .run(id, repoId);
      }
    })();
    return this.getSecretGroup(id) as Promise<SecretGroup>;
  }

  updateSecretGroup(
    groupId: string,
    patch: Partial<Pick<SecretGroup, "name" | "description" | "secretNames" | "repoIds">>,
  ): Promise<SecretGroup | null> {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const updates: string[] = ["updated_at = ?"];
      const params: unknown[] = [now];
      if (patch.name !== undefined) { updates.push("name = ?"); params.push(patch.name); }
      if ("description" in patch) { updates.push("description = ?"); params.push(patch.description ?? null); }
      if (patch.secretNames !== undefined) { updates.push("secret_names = ?"); params.push(JSON.stringify(patch.secretNames)); }
      params.push(groupId);
      this.db.prepare(`UPDATE secret_groups SET ${updates.join(", ")} WHERE id = ?`).run(...params);

      if (patch.repoIds !== undefined) {
        this.db.prepare(`DELETE FROM secret_group_repos WHERE group_id = ?`).run(groupId);
        for (const repoId of patch.repoIds) {
          this.db
            .prepare(`INSERT OR IGNORE INTO secret_group_repos (group_id, repository_id) VALUES (?, ?)`)
            .run(groupId, repoId);
        }
      }
    })();
    return this.getSecretGroup(groupId);
  }

  deleteSecretGroup(groupId: string): Promise<void> {
    this.db.prepare(`DELETE FROM secret_groups WHERE id = ?`).run(groupId);
    return Promise.resolve();
  }

  touchSecretGroupRotatedAt(groupId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE secret_groups SET last_rotated_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, groupId);
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

  listAuditLog(opts: {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<AuditLogEntry>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 50;
    const offset = (page - 1) * perPage;

    const conditions: string[] = [];
    const filterParams: (string | number | null)[] = [];
    if (opts.action) { conditions.push("action = ?"); filterParams.push(opts.action); }
    if (opts.resourceType) { conditions.push("resource_type = ?"); filterParams.push(opts.resourceType); }
    if (opts.resourceId) { conditions.push("resource_id = ?"); filterParams.push(opts.resourceId); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM audit_log ${where}`)
      .get(...filterParams) as { total: number } | undefined;
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...filterParams, perPage, offset) as Record<string, unknown>[];

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

  // ── Webhook Events ──────────────────────────────────────────────────────────

  insertWebhookEvent(event: Omit<WebhookEvent, "id" | "receivedAt">): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO webhook_events
           (id, delivery_id, event_name, action, installation_id, resource_type, resource_id, payload, status, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(delivery_id) DO NOTHING`,
      )
      .run(
        randomUUID(),
        event.deliveryId,
        event.eventName,
        event.action ?? null,
        event.installationId ?? null,
        event.resourceType ?? null,
        event.resourceId ?? null,
        JSON.stringify(event.payload),
        event.status,
        event.error ?? null,
      );
    return Promise.resolve();
  }

  updateWebhookEventStatus(
    deliveryId: string,
    status: WebhookEvent["status"],
    error?: string,
  ): Promise<void> {
    this.db
      .prepare(`UPDATE webhook_events SET status = ?, error = ? WHERE delivery_id = ?`)
      .run(status, error ?? null, deliveryId);
    return Promise.resolve();
  }

  getWebhookEvent(deliveryId: string): Promise<WebhookEvent | null> {
    const row = this.db
      .prepare(`SELECT * FROM webhook_events WHERE delivery_id = ? LIMIT 1`)
      .get(deliveryId) as Record<string, unknown> | undefined;
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapWebhookEvent(row));
  }

  listWebhookEvents(opts: {
    status?: string;
    eventName?: string;
    resourceId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<WebhookEvent>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 50;
    const offset = (page - 1) * perPage;

    const conditions: string[] = [];
    const filterParams: (string | number | null)[] = [];
    if (opts.status) { conditions.push("status = ?"); filterParams.push(opts.status); }
    if (opts.eventName) { conditions.push("event_name = ?"); filterParams.push(opts.eventName); }
    if (opts.resourceId) { conditions.push("resource_id = ?"); filterParams.push(opts.resourceId); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM webhook_events ${where}`)
      .get(...filterParams) as { total: number } | undefined;
    const total = countRow?.total ?? 0;

    const rows = this.db
      .prepare(
        `SELECT * FROM webhook_events ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...filterParams, perPage, offset) as Record<string, unknown>[];

    return Promise.resolve({
      items: rows.map((row) => this.mapWebhookEvent(row)),
      total,
      page,
      perPage,
      hasMore: total > page * perPage,
    });
  }

  private mapWebhookEvent(row: Record<string, unknown>): WebhookEvent {
    return {
      id: row["id"] as string,
      deliveryId: row["delivery_id"] as string,
      eventName: row["event_name"] as string,
      action: (row["action"] as string | null) ?? null,
      installationId: (row["installation_id"] as number | null) ?? null,
      resourceType: (row["resource_type"] as string | null) ?? null,
      resourceId: (row["resource_id"] as string | null) ?? null,
      payload: JSON.parse(row["payload"] as string) as Record<string, unknown>,
      status: row["status"] as WebhookEvent["status"],
      error: (row["error"] as string | null) ?? null,
      receivedAt: row["received_at"] as string,
    };
  }

  upsertRelease(release: Omit<Release, "id" | "createdAt" | "updatedAt">): Promise<Release> {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO releases (
        id, repository_id, user_id, github_release_id, tag_name, name, body,
        draft, prerelease, html_url, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repository_id, github_release_id)
      DO UPDATE SET
        tag_name = excluded.tag_name,
        name = excluded.name,
        body = excluded.body,
        draft = excluded.draft,
        prerelease = excluded.prerelease,
        html_url = excluded.html_url,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at
    `).run(
      id, release.repositoryId, release.userId, release.githubReleaseId,
      release.tagName, release.name ?? null, release.body ?? null,
      release.draft ? 1 : 0, release.prerelease ? 1 : 0,
      release.htmlUrl, release.publishedAt ?? null, now, now,
    );
    const row = this.db.prepare(`SELECT * FROM releases WHERE repository_id = ? AND github_release_id = ?`)
      .get(release.repositoryId, release.githubReleaseId) as Record<string, unknown>;
    return Promise.resolve(this.mapRelease(row));
  }

  listReleases(opts: { repositoryId?: string; page?: number; perPage?: number }): Promise<PaginatedResponse<Release>> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 25;
    const offset = (page - 1) * perPage;
    const where = opts.repositoryId ? "WHERE repository_id = ?" : "";
    const params: unknown[] = opts.repositoryId ? [opts.repositoryId] : [];

    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM releases ${where}`).get(...params) as { total: number } | undefined;
    const total = countRow?.total ?? 0;
    const rows = this.db.prepare(`SELECT * FROM releases ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`)
      .all(...params, perPage, offset) as Record<string, unknown>[];

    return Promise.resolve({
      items: rows.map((r) => this.mapRelease(r)),
      total, page, perPage, hasMore: total > page * perPage,
    });
  }

  private mapRelease(row: Record<string, unknown>): Release {
    return {
      id: row["id"] as string,
      repositoryId: row["repository_id"] as string,
      userId: row["user_id"] as string,
      githubReleaseId: row["github_release_id"] as number,
      tagName: row["tag_name"] as string,
      name: (row["name"] as string | null) ?? null,
      body: (row["body"] as string | null) ?? null,
      draft: Boolean(row["draft"]),
      prerelease: Boolean(row["prerelease"]),
      htmlUrl: row["html_url"] as string,
      publishedAt: (row["published_at"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      updatedAt: row["updated_at"] as string,
    };
  }

  getAnalytics(opts: { days?: number }): Promise<{
    byRepo: { repositoryId: string; total: number; success: number; failure: number }[];
    byDay: { date: string; total: number; success: number }[];
  }> {
    const days = opts.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const byRepo = this.db.prepare(`
      SELECT
        repository_id as repositoryId,
        COUNT(*) as total,
        SUM(CASE WHEN conclusion = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN conclusion IN ('failure','timed_out') THEN 1 ELSE 0 END) as failure
      FROM workflow_runs
      WHERE started_at >= ?
      GROUP BY repository_id
      ORDER BY total DESC
    `).all(since) as { repositoryId: string; total: number; success: number; failure: number }[];

    const byDay = this.db.prepare(`
      SELECT
        DATE(started_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN conclusion = 'success' THEN 1 ELSE 0 END) as success
      FROM workflow_runs
      WHERE started_at >= ?
      GROUP BY DATE(started_at)
      ORDER BY date ASC
    `).all(since) as { date: string; total: number; success: number }[];

    return Promise.resolve({ byRepo, byDay });
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
