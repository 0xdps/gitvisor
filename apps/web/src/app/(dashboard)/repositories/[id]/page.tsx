"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPackages, getPullRequests, getReleases, getRepositories, getSecrets, getWorkflowRuns } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { ageInDays, timeAgo } from "@/lib/format";

export default function RepositoryOperationsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: repos = [], isLoading } = useQuery({ queryKey: ["repositories"], queryFn: getRepositories });
  const repo = repos.find((item) => item.id === id);
  const { data: runs } = useQuery({
    queryKey: ["workflows", id],
    queryFn: () => getWorkflowRuns({ repositoryId: id, perPage: 20 }),
    enabled: Boolean(repo),
  });
  const { data: prs = [] } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(100),
    enabled: Boolean(repo),
  });
  const { data: releases } = useQuery({
    queryKey: ["releases", id],
    queryFn: () => getReleases({ repositoryId: id, perPage: 10 }),
    enabled: Boolean(repo),
  });
  const { data: secrets = [] } = useQuery({
    queryKey: ["secrets", id],
    queryFn: () => getSecrets(id),
    enabled: Boolean(repo),
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["packages", id],
    queryFn: () => getPackages(id),
    enabled: Boolean(repo),
  });

  if (!repo && !isLoading) {
    return <PageHeader kicker="Repository" title="Repository not found" detail="It may still be syncing, or it belongs to another account." />;
  }
  if (!repo) return <PageHeader kicker="Repository" title="Loading operations" />;

  const repoPrs = prs.filter((pr) => pr.repoId === repo.id || pr.repoFullName === repo.fullName);
  const defaultRuns = (runs?.items ?? []).filter((run) => run.branch === repo.defaultBranch);
  const latestDefault = defaultRuns[0];
  const failing = latestDefault?.status === "completed" && (latestDefault.conclusion === "failure" || latestDefault.conclusion === "timed_out");
  const staleSecrets = secrets.filter((secret) => ageInDays(secret.githubUpdatedAt ?? secret.updatedAt) > 180).length;
  const verdict = repo.locked
    ? "Locked by the current plan"
    : failing
      ? `${latestDefault?.workflowName ?? "CI"} is blocking ${repo.defaultBranch}`
      : `${repo.defaultBranch} is clear · ${repoPrs.length} open PRs · ${staleSecrets} secrets due for rotation`;

  return (
    <div className="space-y-6">
      <PageHeader kicker={repo.fullName} title={verdict} detail={`Last push ${timeAgo(repo.pushedAt)} · synced ${timeAgo(repo.syncedAt)}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Signal label="Default branch" value={failing ? "Failing" : latestDefault ? "Passing" : "No runs"} href={`/workflows?repositoryId=${repo.id}`} />
        <Signal label="Open pull requests" value={String(repoPrs.length)} href="/pull-requests" />
        <Signal label="Latest release" value={releases?.items[0]?.tagName ?? "None"} href={`/releases?repositoryId=${repo.id}`} />
        <Signal label="Secrets overdue" value={String(staleSecrets)} href={`/secrets?tab=repo&repositoryId=${repo.id}`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Recent workflows" href={`/workflows?repositoryId=${repo.id}`}>
          {(runs?.items ?? []).slice(0, 6).map((run) => (
            <a key={run.id} href={run.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]">
              <span className={`h-2 w-2 rounded-full ${run.conclusion === "failure" ? "bg-destructive" : run.status !== "completed" ? "bg-blue" : "bg-success"}`} />
              <span className="min-w-0 flex-1 truncate text-xs">{run.workflowName}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{run.branch}</span>
            </a>
          ))}
        </Panel>
        <Panel title="Open pull requests" href="/pull-requests">
          {repoPrs.slice(0, 6).map((pr) => (
            <a key={pr.id} href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 hover:bg-white/[0.03]">
              <span className="block truncate text-xs">{pr.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">#{pr.number} · idle {timeAgo(pr.updatedAt)}</span>
            </a>
          ))}
        </Panel>
        <Panel title="Releases" href={`/releases?repositoryId=${repo.id}`}>
          {(releases?.items ?? []).slice(0, 6).map((release) => (
            <a key={release.id} href={release.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex justify-between px-4 py-2.5 text-xs hover:bg-white/[0.03]">
              <span className="font-mono">{release.tagName}</span>
              <span className="text-muted-foreground">{timeAgo(release.publishedAt)}</span>
            </a>
          ))}
        </Panel>
        <Panel title="Packages and secrets" href={`/packages?repositoryId=${repo.id}`}>
          {packages.slice(0, 4).map((item) => (
            <div key={item.id} className="flex justify-between px-4 py-2.5 text-xs">
              <span>{item.name}</span>
              <span className="font-mono text-muted-foreground">{item.latestVersion ?? item.ecosystem}</span>
            </div>
          ))}
          <Link href={`/secrets?tab=repo&repositoryId=${repo.id}`} className="block px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
            {secrets.length} secret names · {staleSecrets} older than 180 days
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function Signal({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 hover:bg-white/[0.03]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-2 block truncate text-lg font-semibold">{value}</span>
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="text-[11px] text-muted-foreground hover:text-foreground">Open</Link>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}
