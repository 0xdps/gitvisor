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
    getUserDb: (_userId: string) => {
      // Guard against accidental multi-user deployments on the shared SQLite instance.
      // If more than one user has signed in, all data is co-mingled — reject immediately
      // so the operator is forced to either use the cloud (per-user MesaHub DB) or
      // deploy a fresh single-user instance.
      const userCount = registry.countUsers();
      if (userCount > 1) {
        throw new Error(
          `OSS core single-user guard: ${userCount} users found in the registry. ` +
            "The shared SQLite instance does not support multiple users — " +
            "data cross-contamination would occur. " +
            "For multi-user support deploy the cloud edition (gitvisor.dev).",
        );
      }
      return Promise.resolve(userDb);
    },
  };
}
