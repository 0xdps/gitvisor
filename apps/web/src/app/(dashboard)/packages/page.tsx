"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, RefreshCw, Lock, Globe, Download } from "lucide-react";
import { getRepositories, getPackages } from "@/lib/api-client";
import type { Package as PackageType, Repository } from "@gitvisor/shared";

function PackagesContent() {
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const queryClient = useQueryClient();

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const selectedRepo = repos?.find((r) => r.id === repositoryId);
  const repoMap = new Map(repos?.map((r) => [r.id, r]) ?? []);

  const { data: packages, isLoading, error } = useQuery({
    queryKey: ["packages", repositoryId],
    queryFn: () => getPackages(repositoryId),
    staleTime: 60_000,
  });

  // Always load the unfiltered list so we know which repos actually have packages.
  // React Query deduplicates this when repositoryId is already undefined.
  const { data: allPackages } = useQuery({
    queryKey: ["packages", undefined],
    queryFn: () => getPackages(undefined),
    staleTime: 60_000,
  });

  // Only show repos that have ≥1 package. Fall back to all repos while loading.
  const repoIdsWithPackages = new Set(
    allPackages?.map((p) => p.repositoryId).filter(Boolean) ?? [],
  );
  const reposWithPackages = allPackages
    ? (repos?.filter((r) => repoIdsWithPackages.has(r.id)) ?? [])
    : (repos ?? []);
  // Always include the currently-selected repo in the tabs (even if its packages
  // haven't been counted yet) so the active tab never disappears.
  const tabRepos =
    repositoryId && selectedRepo && !reposWithPackages.find((r) => r.id === repositoryId)
      ? [...reposWithPackages, selectedRepo]
      : reposWithPackages;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Packages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedRepo
              ? `Packages for ${selectedRepo.fullName}`
              : "All packages across your repositories."}
          </p>
        </div>
        {selectedRepo && (
          <button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["packages"] })
            }
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}
      </div>

      {tabRepos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/packages"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !repositoryId
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            All
          </Link>
          {tabRepos.map((repo) => (
            <Link
              key={repo.id}
              href={`/packages?repositoryId=${repo.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                repositoryId === repo.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              {repo.name}
            </Link>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load packages.
        </div>
      )}

      {packages && packages.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No packages</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Packages published from your repositories will appear here.
          </p>
        </div>
      )}

      {packages && packages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              repo={pkg.repositoryId ? (repoMap.get(pkg.repositoryId) ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ECO_COLORS: Record<string, string> = {
  npm: "#cc3534",
  docker: "#2496ED",
  container: "#2496ED",
  maven: "#C71A36",
  rubygems: "#E9573F",
  nuget: "#004880",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function PackageCard({ pkg, repo }: { pkg: PackageType; repo: Repository | null }) {
  const ecoColor = ECO_COLORS[pkg.ecosystem] ?? "#6b7280";
  // GitHub package page: github.com/{owner}/{repo}/pkgs/{ecosystem}/{name}
  const ghUrl = repo
    ? `https://github.com/${repo.fullName}/pkgs/${pkg.ecosystem}/${pkg.name}`
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:bg-accent/10 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: ecoColor }}
            />
            {ghUrl ? (
              <a
                href={ghUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold truncate hover:text-blue transition-colors"
              >
                {pkg.name}
              </a>
            ) : (
              <p className="text-sm font-semibold truncate">{pkg.name}</p>
            )}
            {pkg.latestVersion && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                v{pkg.latestVersion}
              </span>
            )}
          </div>
          {repo?.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-4 leading-relaxed">
              {repo.description}
            </p>
          )}
          {repo && !repo.description && (
            <p className="text-xs text-muted-foreground mt-1 truncate pl-4">{repo.fullName}</p>
          )}
        </div>
        {pkg.visibility === "private" ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="capitalize font-medium" style={{ color: ecoColor }}>
          {pkg.ecosystem}
        </span>
        {pkg.downloadCount != null && pkg.downloadCount > 0 && (
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {fmtDownloads(pkg.downloadCount)}
          </span>
        )}
        {ghUrl && (
          <a
            href={ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
        {!ghUrl && (
          <span className="ml-auto">{timeAgo(pkg.updatedAt)}</span>
        )}
        {ghUrl && (
          <span className="text-muted-foreground/50">{timeAgo(pkg.updatedAt)}</span>
        )}
      </div>
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      }
    >
      <PackagesContent />
    </Suspense>
  );
}
