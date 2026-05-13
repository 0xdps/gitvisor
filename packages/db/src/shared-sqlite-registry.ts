import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { RegistryRepository } from "./registry.repository.js";
import type { User, Installation, Repository } from "@gitvisor/shared";

/**
 * RegistryRepository backed by a single local SQLite file.
 * Used by the OSS core — all users share one registry DB on the same instance.
 */
export class SharedSqliteRegistryRepository implements RegistryRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  migrate(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        github_username TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        nube_auth_user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_db_refs (
        user_id TEXT PRIMARY KEY,
        db_ref TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS installations (
        id TEXT PRIMARY KEY,
        github_installation_id INTEGER UNIQUE NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        account_login TEXT NOT NULL,
        account_type TEXT NOT NULL,
        app_slug TEXT NOT NULL,
        suspended INTEGER NOT NULL DEFAULT 0,
        uninstalled_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        github_repo_id INTEGER NOT NULL,
        installation_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        private INTEGER NOT NULL DEFAULT 0,
        default_branch TEXT NOT NULL DEFAULT 'main',
        UNIQUE(github_repo_id, user_id)
      );
    `);
    this.migrateColumns();
    return Promise.resolve();
  }

  // Run after CREATE TABLE to backfill columns added in later versions
  private migrateColumns(): void {
    try {
      this.db.exec(`ALTER TABLE installations ADD COLUMN uninstalled_at TEXT`);
    } catch {
      // column already exists — safe to ignore
    }
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  upsertUser(user: Omit<User, "createdAt"> & { createdAt?: string }): Promise<User> {
    const createdAt = user.createdAt ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO users (id, github_username, email, name, avatar_url, nube_auth_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           github_username   = excluded.github_username,
           email             = excluded.email,
           name              = excluded.name,
           avatar_url        = excluded.avatar_url,
           nube_auth_user_id = COALESCE(excluded.nube_auth_user_id, nube_auth_user_id)`,
      )
      .run(
        user.id,
        user.githubUsername,
        user.email,
        user.name ?? null,
        user.avatarUrl ?? null,
        user.nubeAuthUserId ?? null,
        createdAt,
      );
    return Promise.resolve({ ...user, createdAt });
  }

  getUserById(id: string): Promise<User | null> {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`)
      .get(id) as Record<string, unknown> | undefined;
    return Promise.resolve(row ? this.mapUser(row) : null);
  }

  getUserByGithubUsername(githubUsername: string): Promise<User | null> {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE github_username = ? LIMIT 1`)
      .get(githubUsername) as Record<string, unknown> | undefined;
    return Promise.resolve(row ? this.mapUser(row) : null);
  }

  private mapUser(row: Record<string, unknown>): User {
    return {
      id: row["id"] as string,
      githubUsername: (row["github_username"] as string) ?? "",
      email: row["email"] as string,
      name: (row["name"] as string | null) ?? null,
      avatarUrl: (row["avatar_url"] as string | null) ?? null,
      nubeAuthUserId: (row["nube_auth_user_id"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
    };
  }

  // ── User DB refs ──────────────────────────────────────────────────────────

  getUserDbRef(userId: string): Promise<string | null> {
    const row = this.db
      .prepare(`SELECT db_ref FROM user_db_refs WHERE user_id = ? LIMIT 1`)
      .get(userId) as Record<string, unknown> | undefined;
    return Promise.resolve((row?.["db_ref"] as string | undefined) ?? null);
  }

  setUserDbRef(userId: string, dbRef: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_db_refs (user_id, db_ref, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET db_ref = excluded.db_ref, updated_at = excluded.updated_at`,
      )
      .run(userId, dbRef);
    return Promise.resolve();
  }

  // ── Installations ─────────────────────────────────────────────────────────

  upsertInstallation(installation: Omit<Installation, "createdAt" | "updatedAt">): Promise<Installation> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO installations (
           id, github_installation_id, user_id, account_login, account_type,
           app_slug, suspended, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_installation_id) DO UPDATE SET
           account_login = excluded.account_login,
           suspended     = excluded.suspended,
           updated_at    = excluded.updated_at`,
      )
      .run(
        installation.id,
        installation.githubInstallationId,
        installation.userId,
        installation.accountLogin,
        installation.accountType,
        installation.appSlug,
        installation.suspended ? 1 : 0,
        now,
        now,
      );
    return Promise.resolve({ ...installation, createdAt: now, updatedAt: now });
  }

  getInstallationByGitHubId(githubInstallationId: number): Promise<Installation | null> {
    const row = this.db
      .prepare(`SELECT * FROM installations WHERE github_installation_id = ? LIMIT 1`)
      .get(githubInstallationId) as Record<string, unknown> | undefined;
    return Promise.resolve(row ? this.mapInstallation(row) : null);
  }

  listInstallationsByUser(userId: string): Promise<Installation[]> {
    const rows = this.db
      .prepare(`SELECT * FROM installations WHERE user_id = ? ORDER BY created_at DESC`)
      .all(userId) as Record<string, unknown>[];
    return Promise.resolve(rows.map((r) => this.mapInstallation(r)));
  }

  deleteInstallation(githubInstallationId: number): Promise<void> {
    this.db
      .prepare(`DELETE FROM installations WHERE github_installation_id = ?`)
      .run(githubInstallationId);
    return Promise.resolve();
  }

  markInstallationUninstalled(githubInstallationId: number): Promise<void> {
    this.db
      .prepare(
        `UPDATE installations
         SET uninstalled_at = datetime('now'), updated_at = datetime('now')
         WHERE github_installation_id = ?`,
      )
      .run(githubInstallationId);
    return Promise.resolve();
  }

  private mapInstallation(row: Record<string, unknown>): Installation {
    return {
      id: row["id"] as string,
      githubInstallationId: row["github_installation_id"] as number,
      userId: row["user_id"] as string,
      accountLogin: row["account_login"] as string,
      accountType: row["account_type"] as "User" | "Organization",
      appSlug: row["app_slug"] as string,
      suspended: (row["suspended"] as number) === 1,
      uninstalledAt: (row["uninstalled_at"] as string | null) ?? null,
      createdAt: row["created_at"] as string,
      updatedAt: row["updated_at"] as string,
    };
  }

  // ── Repositories (registry-side, lightweight) ─────────────────────────────

  upsertRepository(repo: Omit<Repository, "createdAt" | "updatedAt" | "syncedAt">): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO repositories (id, github_repo_id, installation_id, user_id, full_name, private, default_branch)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_repo_id, user_id) DO UPDATE SET
           full_name      = excluded.full_name,
           private        = excluded.private,
           default_branch = excluded.default_branch`,
      )
      .run(
        repo.id,
        repo.githubRepoId,
        repo.installationId,
        repo.userId,
        repo.fullName,
        repo.private ? 1 : 0,
        repo.defaultBranch,
      );
    return Promise.resolve();
  }

  listRepositoriesByInstallation(installationId: number): Promise<Repository[]> {
    const rows = this.db
      .prepare(`SELECT * FROM repositories WHERE installation_id = ?`)
      .all(installationId) as Record<string, unknown>[];
    return Promise.resolve(
      rows.map((row) => {
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
          archived: false,
          defaultBranch: row["default_branch"] as string,
          description: null,
          language: null,
          stargazersCount: 0,
          watchersCount: 0,
          forksCount: 0,
          openIssuesCount: 0,
          openPullsCount: 0,
          pushedAt: null,
          syncedAt: null,
          createdAt: "",
          updatedAt: "",
        };
      }),
    );
  }
}

/**
 * Creates a SharedSqliteRegistryRepository and runs migrations.
 * Returns the ready-to-use repository.
 */
export async function createSharedSqliteRegistry(
  path: string,
): Promise<SharedSqliteRegistryRepository> {
  const registry = new SharedSqliteRegistryRepository(path);
  await registry.migrate();
  return registry;
}
