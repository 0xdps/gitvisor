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
 * All users share a single `data.sqlite` — no per-user isolation.
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
    getUserDb: (_userId: string) => Promise.resolve(userDb),
  };
}
