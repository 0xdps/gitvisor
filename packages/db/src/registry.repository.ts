import type { User, Installation, Repository } from "@gitvisor/shared";

/**
 * Registry DB — single shared database that maps users to their MesaHub DB refs.
 * Stores: users, installations, repo metadata index, db provisioning records.
 */
export interface RegistryRepository {
  // Users
  upsertUser(user: Omit<User, "createdAt"> & { createdAt?: string }): Promise<User>;
  getUserById(id: string): Promise<User | null>;

  // MesaHub DB mapping
  getUserDbRef(userId: string): Promise<string | null>;
  setUserDbRef(userId: string, dbRef: string): Promise<void>;

  // GitHub App installations
  upsertInstallation(installation: Omit<Installation, "createdAt" | "updatedAt">): Promise<Installation>;
  getInstallationByGitHubId(githubInstallationId: number): Promise<Installation | null>;
  listInstallationsByUser(userId: string): Promise<Installation[]>;
  deleteInstallation(githubInstallationId: number): Promise<void>;

  // Repository index (lightweight — full data lives in user DB)
  upsertRepository(repo: Omit<Repository, "createdAt" | "updatedAt" | "syncedAt">): Promise<void>;
  listRepositoriesByInstallation(installationId: number): Promise<Repository[]>;
}
