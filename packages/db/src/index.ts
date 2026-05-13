export type { RegistryRepository } from "./registry.repository.js";
export type { UserDbRepository } from "./user-db.repository.js";

export {
  SharedSqliteRegistryRepository,
  createSharedSqliteRegistry,
} from "./shared-sqlite-registry.js";

export {
  SharedSqliteUserDbRepository,
  createSharedSqliteUserDb,
} from "./shared-sqlite-userdb.js";

import {
  createSharedSqliteRegistry,
  SharedSqliteRegistryRepository,
} from "./shared-sqlite-registry.js";
import {
  createSharedSqliteUserDb,
  SharedSqliteUserDbRepository,
} from "./shared-sqlite-userdb.js";
import type { RegistryRepository } from "./registry.repository.js";
import type { UserDbRepository } from "./user-db.repository.js";

export interface SharedSqliteRepositories {
  registry: SharedSqliteRegistryRepository;
  getUserDb: (userId: string) => Promise<SharedSqliteUserDbRepository>;
}

/**
 * Creates shared SQLite-backed repositories for the OSS core.
 *
 * ⚠️  SINGLE-USER ONLY.
 * All users share a single `data.sqlite` file. `getUserDb` ignores the
 * `userId` argument and always returns the same database instance.
 * Repository query methods (listRepositories, listWorkflowRuns, etc.) have
 * no per-user filter — they return every row in the database.
 *
 * Running more than one user on a single self-hosted instance will cause
 * data cross-contamination. For multi-user support use the SaaS cloud
 * (gitvisor.dev) which provisions a dedicated MesaHub SQLite DB per user.
 *
 * Runs migrations on both databases before returning.
 */
export async function createSharedSqliteRepositories(opts: {
  registryPath: string;
  dataPath: string;
}): Promise<SharedSqliteRepositories> {
  const registry = await createSharedSqliteRegistry(opts.registryPath);
  const userDb = await createSharedSqliteUserDb(opts.dataPath);
  return {
    registry,
    // userId is intentionally ignored — single-user SQLite, see JSDoc above.
    getUserDb: (_userId: string) => Promise.resolve(userDb),
  };
}
