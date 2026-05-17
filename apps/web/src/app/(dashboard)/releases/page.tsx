"use client";

import { useState, useEffect, useTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tag,
  RefreshCw,
  ExternalLink,
  GitBranch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getReleases, syncReleases, getRepositories } from "@/lib/api-client";
import { useAccount } from "@/lib/account-context";

interface ReleasesPageProps {
  searchParams: Promise<{ repositoryId?: string; page?: string }>;
}

export default function ReleasesPage({ searchParams }: ReleasesPageProps) {
  return <ReleasesContent searchParams={searchParams} />;
}

function ReleasesContent({
  searchParams,
}: {
  searchParams: Promise<{ repositoryId?: string; page?: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const [resolvedParams, setResolvedParams] = useState<{
    repositoryId?: string;
    page?: string;
  }>({});
  const [paramsLoaded, setParamsLoaded] = useState(false);

  // Resolve the Promise<searchParams> on mount only
  useEffect(() => {
    searchParams.then((p) => {
      setResolvedParams(p);
      setParamsLoaded(true);
    });
  }, [searchParams]);

  const repositoryId = resolvedParams.repositoryId || undefined;
  const page = Math.max(1, Number(resolvedParams.page ?? 1));

  const navigate = (overrides: { repositoryId?: string; page?: number }) => {
    const next = { repositoryId, page, ...overrides };
    const params = new URLSearchParams();
    if (next.repositoryId) params.set("repositoryId", next.repositoryId);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    startTransition(() => {
      router.replace(`/releases${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  };

  const reposQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 60_000,
  });

  const releasesQuery = useQuery({
    queryKey: ["releases", repositoryId, page],
    queryFn: () => getReleases({
      ...(repositoryId !== undefined ? { repositoryId } : {}),
      page,
      perPage: 25,
    }),
    staleTime: 30_000,
    enabled: paramsLoaded,
  });

  const syncMutation = useMutation({
    mutationFn: (repoId: string) => syncReleases(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
  });

  const { selected: selectedAccount } = useAccount();
  const repos = reposQuery.data ?? [];
  const scopedRepos = selectedAccount
    ? repos.filter((r) => r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"))
    : repos;
  const scopedRepoIds = new Set(scopedRepos.map((r) => r.id));
  const result = releasesQuery.data;
  const allReleases = result?.items ?? [];
  const releases = selectedAccount && !repositoryId
    ? allReleases.filter((r) => scopedRepoIds.has(r.repositoryId))
    : allReleases;
  const total = selectedAccount && !repositoryId ? releases.length : (result?.total ?? 0);
  const hasMore = result?.hasMore ?? false;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Releases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0 ? `${total} release${total !== 1 ? "s" : ""}` : "No releases synced yet"}
          </p>
        </div>
        {repositoryId && (
          <button
            onClick={() => syncMutation.mutate(repositoryId)}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-white hover:border-blue transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={syncMutation.isPending ? "animate-spin" : ""}
            />
            Sync releases
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={repositoryId ?? ""}
          onChange={(e) => {
            const v = e.target.value || undefined;
            navigate({ ...(v !== undefined ? { repositoryId: v } : {}), page: 1 });
          }}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm text-white focus:outline-none focus:border-blue min-w-[200px]"
        >
          <option value="">All repositories</option>
          {scopedRepos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Release list */}
      {releasesQuery.isPending || !paramsLoaded ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Tag size={40} className="text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-sm">No releases found.</p>
          {repositoryId && (
            <button
              onClick={() => syncMutation.mutate(repositoryId)}
              disabled={syncMutation.isPending}
              className="mt-4 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
              Sync releases for this repo
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {releases.map((release) => {
            const repo = repos.find((r) => r.id === release.repositoryId);
            return (
              <div
                key={release.id}
                className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-4 hover:border-blue/40 transition-colors"
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0 rounded-md bg-muted/40 p-2">
                  <Tag size={16} className="text-muted-foreground" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">
                      {release.name ?? release.tagName}
                    </span>
                    <code className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                      {release.tagName}
                    </code>
                    {release.prerelease && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full border border-warning/50 text-warning bg-warning/10">
                        Pre-release
                      </span>
                    )}
                    {release.draft && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full border border-border text-muted-foreground bg-muted/20">
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {repo && (
                      <span className="flex items-center gap-1">
                        <GitBranch size={11} />
                        {repo.fullName}
                      </span>
                    )}
                    {release.publishedAt && (
                      <span>
                        {new Date(release.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  {release.body && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {release.body}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <a
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 mt-1 text-muted-foreground hover:text-blue transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Page {page} · {total} total
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ page: page - 1 })}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-white hover:border-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              onClick={() => navigate({ page: page + 1 })}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-white hover:border-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
