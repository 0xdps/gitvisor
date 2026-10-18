"use client";

import { useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkmark, Copy, Download, Globe, Launch, Locked, Package, Renew } from "@carbon/icons-react";
import { Button, Dropdown, InlineLoading, InlineNotification, Tag, Tile } from "@carbon/react";
import { getRepositories, getPackages } from "@/lib/api-client";
import type { Package as PackageType, Repository } from "@gitvisor/shared";
import { useAccount } from "@/lib/account-context";
import { PageHeader } from "@/components/page-header";

function PackagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const queryClient = useQueryClient();

  const { selected: selectedAccount } = useAccount();

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
  const allRepos = repos ?? [];
  const scopedRepos = selectedAccount
    ? allRepos.filter((r) => r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"))
    : allRepos;
  const reposWithPackages = allPackages
    ? scopedRepos.filter((r) => repoIdsWithPackages.has(r.id))
    : scopedRepos;
  // Always include the currently-selected repo in the tabs (even if its packages
  // haven't been counted yet) so the active tab never disappears.
  const tabRepos =
    repositoryId && selectedRepo && !reposWithPackages.find((r) => r.id === repositoryId)
      ? [...reposWithPackages, selectedRepo]
      : reposWithPackages;

  return (
    <div>
      <div className="flex items-start justify-between">
        <PageHeader
          kicker="Artifacts"
          title="Packages"
          detail={
            selectedRepo
              ? `Packages for ${selectedRepo.fullName}`
              : "All packages across your repositories."
          }
        />
        {selectedRepo && (
          <Button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["packages"] })
            }
            kind="tertiary"
            size="sm"
            renderIcon={Renew}
          >
            Refresh
          </Button>
        )}
      </div>

      {tabRepos.length > 0 && (
        <div style={{ marginTop: "1.5rem", maxWidth: "24rem" }}>
          <Dropdown
            id="package-repository"
            titleText="Repository"
            label="All repositories"
            size="sm"
            items={[{ id: "", text: "All repositories" }, ...tabRepos.map((repo) => ({ id: repo.id, text: repo.fullName }))]}
            itemToString={(item) => item?.text ?? ""}
            selectedItem={repositoryId ? { id: repositoryId, text: selectedRepo?.fullName ?? repositoryId } : { id: "", text: "All repositories" }}
            onChange={({ selectedItem }) => router.push(selectedItem?.id ? `/packages?repositoryId=${selectedItem.id}` : "/packages")}
          />
        </div>
      )}

      {isLoading && (
        <div style={{ marginTop: "1.5rem" }}><InlineLoading description="Loading packages" /></div>
      )}

      {error && (
        <InlineNotification kind="error" title="Packages not loaded" subtitle="Try refreshing this page." hideCloseButton lowContrast style={{ marginTop: "1.5rem" }} />
      )}

      {packages && packages.length === 0 && (
        <InlineNotification kind="info" title="No packages" subtitle="Packages published from your repositories will appear here." hideCloseButton lowContrast style={{ marginTop: "1.5rem" }} />
      )}

      {packages && packages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ marginTop: "1.5rem" }}>
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

function getInstallCommand(pkg: PackageType, repo: Repository | null): string | null {
  const owner = repo?.owner.toLowerCase() ?? "owner";
  const ver = pkg.latestVersion ? `@${pkg.latestVersion}` : "";
  const verTag = pkg.latestVersion ?? "latest";
  switch (pkg.ecosystem) {
    case "npm":
      return `npm install ${pkg.name}${ver}`;
    case "docker":
    case "container":
      return `docker pull ghcr.io/${owner}/${pkg.name}:${verTag}`;
    case "maven":
      return `<!-- Maven -->
<dependency>
  <groupId>${owner}</groupId>
  <artifactId>${pkg.name}</artifactId>
  <version>${verTag}</version>
</dependency>`;
    case "rubygems":
      return `gem install ${pkg.name}${pkg.latestVersion ? ` -v ${pkg.latestVersion}` : ""}`;
    case "nuget":
      return `dotnet add package ${pkg.name}${pkg.latestVersion ? ` --version ${pkg.latestVersion}` : ""}`;
    default:
      return null;
  }
}

function PackageCard({ pkg, repo }: { pkg: PackageType; repo: Repository | null }) {
  const [copied, setCopied] = useState(false);
  const ecoColor = ECO_COLORS[pkg.ecosystem] ?? "#6b7280";
  const ghUrl = repo
    ? `https://github.com/${repo.fullName}/pkgs/${pkg.ecosystem}/${pkg.name}`
    : null;
  const installCmd = getInstallCommand(pkg, repo);

  function copyCommand() {
    if (!installCmd) return;
    void navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Tile style={{ height: "100%", padding: 0, display: "flex", flexDirection: "column" }}>
      {/* Repo context header */}
      {repo && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-muted/20">
          <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{repo.fullName}</span>
          {repo.private ? (
            <Locked size={14} />
          ) : (
            <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Package name + version + ecosystem */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ecoColor }} />
              {ghUrl ? (
                <a href={ghUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold truncate hover:text-blue transition-colors">
                  {pkg.name}
                </a>
              ) : (
                <p className="text-sm font-semibold truncate">{pkg.name}</p>
              )}
              {pkg.latestVersion && <Tag size="sm" type="gray">v{pkg.latestVersion}</Tag>}
            </div>
            {repo?.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {repo.description}
              </p>
            )}
          </div>
        </div>

        {/* Ecosystem + stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize font-medium" style={{ color: ecoColor }}>{pkg.ecosystem}</span>
          {pkg.downloadCount != null && pkg.downloadCount > 0 && (
            <span className="flex items-center gap-1">
              <Download size={14} />
              {fmtDownloads(pkg.downloadCount)}
            </span>
          )}
          <span className="ml-auto">{timeAgo(pkg.updatedAt)}</span>
          {ghUrl && (
            <Button as="a" href={ghUrl} target="_blank" rel="noopener noreferrer" kind="ghost" size="sm" hasIconOnly renderIcon={Launch} iconDescription="Open package on GitHub" />
          )}
        </div>

        {/* Install command */}
        {installCmd && (
          <div className="rounded-md bg-muted/40 border border-border/60">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/40">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">Install</span>
              <Button
                onClick={copyCommand}
                kind="ghost"
                size="sm"
                renderIcon={copied ? Checkmark : Copy}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <pre className="px-3 py-2 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">{installCmd}</pre>
          </div>
        )}
      </div>
    </Tile>
  );
}

export default function PackagesPage() {
  return (
    <Suspense
      fallback={<InlineLoading description="Loading packages" />}
    >
      <PackagesContent />
    </Suspense>
  );
}
