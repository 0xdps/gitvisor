import type { Octokit } from "@octokit/rest";
import type { Package, PackageEcosystem } from "@gitvisor/shared";

// "container" (ghcr.io) requires Container Registry OAuth scopes that GitHub App
// installations don't always have — GitHub returns 400 instead of an empty list,
// which creates log noise. "docker" covers GitHub Packages Docker images.
const SUPPORTED_ECOSYSTEMS: PackageEcosystem[] = ["npm", "docker", "maven", "rubygems", "nuget"];

export async function listPackages(
  octokit: Octokit,
  owner: string,
  packageType: PackageEcosystem,
) {
  const { data } = await octokit.rest.packages.listPackagesForUser({
    username: owner,
    package_type: packageType,
  });
  return data;
}

export function mapPackage(
  raw: {
    id: number;
    name: string;
    package_type: string;
    visibility: string;
    version_count?: number;
    created_at: string | null;
    updated_at: string | null;
  },
  repositoryId: string,
  userId: string,
): Omit<Package, "id" | "latestVersion" | "downloadCount"> {
  return {
    repositoryId,
    userId,
    githubPackageId: raw.id,
    name: raw.name,
    ecosystem: raw.package_type as PackageEcosystem,
    visibility: raw.visibility as "public" | "private",
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? new Date().toISOString(),
  };
}

export { SUPPORTED_ECOSYSTEMS };
