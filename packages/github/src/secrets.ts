import type { Octokit } from "@octokit/rest";
import type { SecretMeta } from "@gitvisor/shared";

export interface RepoPublicKey {
  keyId: string;
  key: string;
}

export async function getRepoPublicKey(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoPublicKey> {
  const { data } = await octokit.rest.actions.getRepoPublicKey({ owner, repo });
  return { keyId: data.key_id, key: data.key };
}

export async function listRepoSecrets(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Array<{ name: string; created_at: string; updated_at: string }>> {
  const { data } = await octokit.rest.actions.listRepoSecrets({ owner, repo, per_page: 100 });
  return data.secrets;
}

export async function upsertRepoSecret(
  octokit: Octokit,
  owner: string,
  repo: string,
  secretName: string,
  encryptedValue: string,
  keyId: string,
): Promise<void> {
  await octokit.rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: keyId,
  });
}

export async function deleteRepoSecret(
  octokit: Octokit,
  owner: string,
  repo: string,
  secretName: string,
): Promise<void> {
  await octokit.rest.actions.deleteRepoSecret({
    owner,
    repo,
    secret_name: secretName,
  });
}

export function mapSecretMeta(
  raw: { name: string; updated_at: string },
  repositoryId: string,
  userId: string,
): Omit<SecretMeta, "id" | "createdAt" | "updatedAt"> {
  return {
    repositoryId,
    userId,
    name: raw.name,
    scope: "repo",
    environment: null,
    githubUpdatedAt: raw.updated_at,
  };
}
