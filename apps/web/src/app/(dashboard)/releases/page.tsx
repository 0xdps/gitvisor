"use client";

import { useState, useEffect, useTransition } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tag as ReleaseIcon,
  Renew,
  Launch,
  Branch,
  ChevronLeft,
  ChevronRight,
} from "@carbon/icons-react";
import { Button, Dropdown, InlineLoading, InlineNotification, Tag, Tile } from "@carbon/react";
import { getReleases, syncReleases, getRepositories } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
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
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageHeader
          kicker="Ship"
          title="Releases"
          detail={total > 0 ? `${total} release${total !== 1 ? "s" : ""}` : "No releases synced yet"}
        />
        {repositoryId && (
          <Button
            onClick={() => syncMutation.mutate(repositoryId)}
            disabled={syncMutation.isPending}
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
          >
            Sync releases
          </Button>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginTop: "1.5rem", maxWidth: "24rem" }}>
        <Dropdown
          id="release-repository"
          titleText="Repository"
          label="All repositories"
          size="sm"
          items={[{ id: "", text: "All repositories" }, ...scopedRepos.map((repo) => ({ id: repo.id, text: repo.fullName }))]}
          itemToString={(item) => item?.text ?? ""}
          selectedItem={repositoryId ? { id: repositoryId, text: scopedRepos.find((repo) => repo.id === repositoryId)?.fullName ?? repositoryId } : { id: "", text: "All repositories" }}
          onChange={({ selectedItem }) => {
            const v = selectedItem?.id || undefined;
            navigate({ ...(v !== undefined ? { repositoryId: v } : {}), page: 1 });
          }}
        />
      </div>

      {/* Release list */}
      {releasesQuery.isError ? (
        <InlineNotification kind="error" title="Releases not loaded" subtitle="Check your connection and try again." hideCloseButton lowContrast style={{ marginTop: "1.5rem" }} />
      ) : releasesQuery.isPending || !paramsLoaded ? (
        <div style={{ marginTop: "1.5rem" }}><InlineLoading description="Loading releases" /></div>
      ) : releases.length === 0 ? (
        <div style={{ marginTop: "1.5rem" }}>
          <InlineNotification kind="info" title="No releases found" subtitle="Sync a repository to import its release history." hideCloseButton lowContrast />
          {repositoryId && (
            <Button
              onClick={() => syncMutation.mutate(repositoryId)}
              disabled={syncMutation.isPending}
              kind="tertiary"
              size="sm"
              renderIcon={Renew}
              style={{ marginTop: "1rem" }}
            >
              Sync releases for this repo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: "1.5rem" }}>
          {releases.map((release) => {
            const repo = repos.find((r) => r.id === release.repositoryId);
            return (
              <Tile
                key={release.id}
                style={{ height: "100%", display: "flex", alignItems: "flex-start", gap: "1rem" }}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0 rounded-md bg-muted/40 p-2">
                  <ReleaseIcon size={20} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">
                      {release.name ?? release.tagName}
                    </span>
                    <code className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                      {release.tagName}
                    </code>
                    {release.prerelease && (
                      <Tag size="sm" type="magenta">Pre-release</Tag>
                    )}
                    {release.draft && (
                      <Tag size="sm" type="gray">Draft</Tag>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {repo && (
                      <span className="flex items-center gap-1">
                        <Branch size={14} />
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
                <Button
                  as="a"
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={Launch}
                  iconDescription="View release on GitHub"
                />
              </Tile>
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
            <Button
              onClick={() => navigate({ page: page - 1 })}
              disabled={page <= 1}
              kind="ghost"
              size="sm"
              renderIcon={ChevronLeft}
            >
              Previous
            </Button>
            <Button
              onClick={() => navigate({ page: page + 1 })}
              disabled={!hasMore}
              kind="ghost"
              size="sm"
              renderIcon={ChevronRight}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
