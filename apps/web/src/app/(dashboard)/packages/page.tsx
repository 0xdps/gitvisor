"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, RefreshCw, ExternalLink, Lock, Globe } from "lucide-react";
import { getRepositories, getPackages } from "@/lib/api-client";
import type { Package as PackageType } from "@gitvisor/shared";

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

  const { data: packages, isLoading, error } = useQuery({
    queryKey: ["packages", repositoryId],
    queryFn: () => getPackages(repositoryId),
    staleTime: 60_000,
  });

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

      {repos && repos.length > 0 && (
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
          {repos.map((repo) => (
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
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: PackageType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{pkg.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{pkg.ecosystem}</p>
        </div>
        {pkg.visibility === "private" ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
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
