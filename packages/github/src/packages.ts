import type { Octokit } from "@octokit/rest";
import type { Package, PackageEcosystem } from "@gitvisor/shared";

const SUPPORTED_ECOSYSTEMS: PackageEcosystem[] = ["npm", "docker", "container", "maven", "rubygems", "nuget"];

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
