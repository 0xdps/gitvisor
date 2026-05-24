"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  GitBranch,
  GitPullRequest,
  Loader2,
  RotateCcw,
  Tag,
  XCircle,
} from "lucide-react";
import {
  getWorkflowRuns,
  getRepositories,
  getPullRequests,
  getReleases,
  rerunWorkflow,
  cancelWorkflow,
} from "@/lib/api-client";
import type {
  Release,
  RepoPullRequest,
  Repository,
  WorkflowRun,
} from "@gitvisor/shared";
import { useAccount } from "@/lib/account-context";
import { InstallAccountsPanel } from "@/components/install-accounts-panel";

// ── helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function elapsedMs(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Date.now() - new Date(startedAt).getTime();
}

// ── types ──────────────────────────────────────────────────────────────────────

interface FailingRepo {
  repo: Repository;
  lastMainRun: WorkflowRun;
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function OpsCenterPage() {
  const { selected: selectedAccount } = useAccount();
  const queryClient = useQueryClient();

  const { data: runData } = useQuery({
    queryKey: ["workflows", undefined, 1],
    queryFn: () => getWorkflowRuns({ perPage: 50 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: reposData } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const { data: pullRequests = [] } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(50),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const { data: releasesData } = useQuery({
    queryKey: ["releases", undefined, 1],
    queryFn: () => getReleases({ perPage: 30 }),
    staleTime: 60_000,
  });

  const rerunMutation = useMutation({
    mutationFn: (runId: number) => rerunWorkflow(runId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: number) => cancelWorkflow(runId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const allRuns = runData?.items ?? [];
  const allRepos = reposData ?? [];
  const allReleases = releasesData?.items ?? [];

  const scopedRepos = useMemo(
    () =>
      selectedAccount
        ? allRepos.filter((r) =>
            r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"),
          )
        : allRepos,
    [allRepos, selectedAccount],
  );

  const scopedRepoIds = useMemo(() => new Set(scopedRepos.map((r) => r.id)), [scopedRepos]);

  const scopedRuns = useMemo(
    () => (selectedAccount ? allRuns.filter((r) => scopedRepoIds.has(r.repositoryId)) : allRuns),
    [allRuns, selectedAccount, scopedRepoIds],
  );

  const scopedPRs = useMemo(
    () =>
      selectedAccount
        ? pullRequests.filter((pr) =>
            pr.repoFullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"),
          )
        : pullRequests,
    [pullRequests, selectedAccount],
  );

  const scopedReleases = useMemo(
    () =>
      selectedAccount
        ? allReleases.filter((r) => scopedRepoIds.has(r.repositoryId))
        : allReleases,
    [allReleases, selectedAccount, scopedRepoIds],
  );

  const runsPerRepo = useMemo(() => {
    const map = new Map<string, WorkflowRun[]>();
    for (const run of scopedRuns) {
      const arr = map.get(run.repositoryId) ?? [];
      arr.push(run);
      map.set(run.repositoryId, arr);
    }
    return map;
  }, [scopedRuns]);

  const repoById = useMemo(() => new Map(allRepos.map((r) => [r.id, r])), [allRepos]);

  // ── On Fire: most-recent run on default branch is failing ──────────────────
  const failingRepos = useMemo((): FailingRepo[] => {
    const result: FailingRepo[] = [];
    for (const repo of scopedRepos) {
      if (repo.locked) continue;
      const runs = runsPerRepo.get(repo.id) ?? [];
      const mainRuns = runs
        .filter((r) => r.branch === repo.defaultBranch)
        .sort(
          (a, b) =>
            new Date(b.startedAt ?? b.createdAt).getTime() -
            new Date(a.startedAt ?? a.createdAt).getTime(),
        );
      const last = mainRuns[0];
      if (
        last &&
        last.status === "completed" &&
        (last.conclusion === "failure" || last.conclusion === "timed_out")
      ) {
        result.push({ repo, lastMainRun: last });
      }
    }
    return result.sort(
      (a, b) =>
        new Date(b.lastMainRun.startedAt ?? b.lastMainRun.createdAt).getTime() -
        new Date(a.lastMainRun.startedAt ?? a.lastMainRun.createdAt).getTime(),
    );
  }, [scopedRepos, runsPerRepo]);

  // ── In Flight ──────────────────────────────────────────────────────────────
  const inFlightRuns = useMemo(
    () =>
      scopedRuns
        .filter((r) => r.status === "in_progress" && !repoById.get(r.repositoryId)?.locked)
        .sort(
          (a, b) =>
            new Date(a.startedAt ?? a.createdAt).getTime() -
            new Date(b.startedAt ?? b.createdAt).getTime(),
        ),
    [scopedRuns, repoById],
  );

  // ── Stale PRs: not draft, >48h without update ──────────────────────────────
  const stalePRs = useMemo(
    () =>
      scopedPRs
        .filter(
          (pr) =>
            !pr.draft &&
            Date.now() - new Date(pr.updatedAt).getTime() > 48 * 60 * 60 * 1000,
        )
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [scopedPRs],
  );

  // ── Shipped recently: published in last 48h ────────────────────────────────
  const shippedRecently = useMemo(
    () =>
      scopedReleases
        .filter(
          (r) =>
            !r.draft &&
            r.publishedAt &&
            Date.now() - new Date(r.publishedAt).getTime() < 48 * 60 * 60 * 1000,
        )
        .sort(
          (a, b) =>
            new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime(),
        ),
    [scopedReleases],
  );

  const hasData = scopedRepos.length > 0;
  const liveCount = inFlightRuns.length;
  const failingCount = failingRepos.length;

  return (
    <div className="space-y-6">

      {/* Status Strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            liveCount > 0
              ? "border-blue/30 bg-blue/[0.06] text-blue"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          {liveCount > 0 ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute h-full w-full rounded-full bg-blue opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-blue" />
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          )}
          {liveCount > 0 ? `${liveCount} running` : "Nothing running"}
        </div>

        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            failingCount > 0
              ? "border-destructive/30 bg-destructive/[0.08] text-destructive"
              : hasData
                ? "border-success/20 bg-success/[0.08] text-success"
                : "border-border bg-card text-muted-foreground"
          }`}
        >
          {failingCount > 0 ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3 w-3 shrink-0" />
          )}
          {failingCount > 0
            ? `${failingCount} failing on main`
            : hasData
              ? "All branches green"
              : "No repos tracked"}
        </div>

        {scopedPRs.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <GitPullRequest className="h-3 w-3 shrink-0" />
            {scopedPRs.length} open PR{scopedPRs.length !== 1 ? "s" : ""}
          </div>
        )}

        {shippedRecently.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.06] px-3 py-1.5 text-xs font-medium text-success">
            <Tag className="h-3 w-3 shrink-0" />
            {shippedRecently.length} shipped in 48h
          </div>
        )}
      </div>

      {/* On Fire */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          {failingCount > 0 ? (
            <Flame className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          )}
          <h2 className="text-sm font-semibold">
            {failingCount > 0
              ? `On Fire — ${failingCount} repo${failingCount !== 1 ? "s" : ""} blocking deployment`
              : "All Systems Go"}
          </h2>
        </div>

        {failingCount === 0 ? (
          <div
            className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${
              hasData ? "border-success/20 bg-success/[0.04]" : "border-border bg-card"
            }`}
          >
            <CheckCircle2
              className={`h-5 w-5 shrink-0 ${hasData ? "text-success" : "text-muted-foreground/25"}`}
            />
            <div>
              <p className={`text-sm font-medium ${hasData ? "text-success" : "text-muted-foreground/50"}`}>
                {hasData ? "All main branches passing" : "No repositories tracked yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasData
                  ? "No deployment blockers detected."
                  : "Install the GitHub App and sync your repos to get started."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              failingCount === 1
                ? "grid-cols-1 max-w-md"
                : failingCount === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {failingRepos.map(({ repo, lastMainRun }) => (
              <OnFireCard
                key={repo.id}
                repo={repo}
                run={lastMainRun}
                isRerunning={
                  rerunMutation.isPending && rerunMutation.variables === lastMainRun.githubRunId
                }
                onRerun={() => rerunMutation.mutate(lastMainRun.githubRunId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* In Flight */}
      {inFlightRuns.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute h-full w-full rounded-full bg-blue opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-blue" />
            </span>
            <h2 className="text-sm font-semibold">In Flight — {inFlightRuns.length} running now</h2>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
            {inFlightRuns.map((run) => (
              <InFlightRow
                key={run.id}
                run={run}
                repo={repoById.get(run.repositoryId) ?? null}
                isCancelling={
                  cancelMutation.isPending && cancelMutation.variables === run.githubRunId
                }
                onCancel={() => cancelMutation.mutate(run.githubRunId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Stale PRs + Shipped Recently */}
      <div className="grid grid-cols-2 gap-5">

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
              Stale Pull Requests
              {stalePRs.length > 0 && (
                <span className="text-[10px] rounded-full bg-warning/15 border border-warning/25 text-warning/80 px-1.5 py-0.5 font-medium tabular-nums">
                  {stalePRs.length}
                </span>
              )}
            </h2>
            {scopedPRs.length > 0 && (
              <span className="text-[11px] text-muted-foreground/40">
                {scopedPRs.length} open total
              </span>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {stalePRs.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/20 shrink-0" />
                <p className="text-xs text-muted-foreground/50">No stale pull requests</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {stalePRs.slice(0, 8).map((pr) => (
                  <StalePRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} />
                ))}
                {stalePRs.length > 8 && (
                  <div className="px-4 py-2.5 text-[11px] text-muted-foreground/40">
                    +{stalePRs.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              Shipped in 48h
              {shippedRecently.length > 0 && (
                <span className="text-[10px] rounded-full bg-success/15 border border-success/20 text-success px-1.5 py-0.5 font-medium tabular-nums">
                  {shippedRecently.length}
                </span>
              )}
            </h2>
            <Link
              href="/releases"
              className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              All releases
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {shippedRecently.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <Tag className="h-4 w-4 text-muted-foreground/20 shrink-0" />
                <p className="text-xs text-muted-foreground/50">Nothing shipped in the last 48h</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {shippedRecently.slice(0, 8).map((release) => (
                  <ShippedReleaseRow
                    key={release.id}
                    release={release}
                    repoName={repoById.get(release.repositoryId)?.name ?? null}
                  />
                ))}
                {shippedRecently.length > 8 && (
                  <div className="px-4 py-2.5 text-[11px] text-muted-foreground/40">
                    +{shippedRecently.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

      </div>

      {!hasData && (
        <div className="max-w-sm">
          <InstallAccountsPanel />
        </div>
      )}

    </div>
  );
}

// ── OnFireCard ─────────────────────────────────────────────────────────────────

function OnFireCard({
  repo,
  run,
  isRerunning,
  onRerun,
}: {
  repo: Repository;
  run: WorkflowRun;
  isRerunning: boolean;
  onRerun: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] overflow-hidden">
      <div className="border-l-[3px] border-l-destructive px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <h3 className="text-sm font-semibold truncate">{repo.name}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono truncate">
              {run.workflowName}
            </p>
          </div>
          <span className="text-[11px] text-destructive/60 shrink-0 tabular-nums">
            {timeAgo(run.completedAt ?? run.startedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <GitBranch className="h-3 w-3 shrink-0" />
          <span>{run.branch}</span>
          {run.commitSha && (
            <>
              <span className="opacity-30">·</span>
              <span className="opacity-60">{run.commitSha.slice(0, 7)}</span>
            </>
          )}
          {run.conclusion === "timed_out" && (
            <>
              <span className="opacity-30">·</span>
              <span className="text-warning/80 not-mono">timed out</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRerun}
            disabled={isRerunning}
            className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
          >
            {isRerunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Rerun
          </button>
          <a
            href={run.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            View logs
            <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── InFlightRow ────────────────────────────────────────────────────────────────

function InFlightRow({
  run,
  repo,
  isCancelling,
  onCancel,
}: {
  run: WorkflowRun;
  repo: Repository | null;
  isCancelling: boolean;
  onCancel: () => void;
}) {
  const elapsed = elapsedMs(run.startedAt);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.015] transition-colors">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute h-full w-full rounded-full bg-blue opacity-60" />
        <span className="relative h-2 w-2 rounded-full bg-blue" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{run.workflowName}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono flex items-center gap-1.5 truncate">
          {repo && <span>{repo.name}</span>}
          {repo && <span className="opacity-40">·</span>}
          <span className="truncate">{run.branch}</span>
          {run.commitSha && (
            <>
              <span className="opacity-40">·</span>
              <span className="opacity-60 shrink-0">{run.commitSha.slice(0, 7)}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-blue/70 tabular-nums shrink-0">
        <Clock className="h-3 w-3" />
        {formatDuration(elapsed)}
      </div>
      <button
        onClick={onCancel}
        disabled={isCancelling}
        className="flex items-center text-[11px] text-muted-foreground/30 hover:text-destructive disabled:opacity-50 transition-colors shrink-0"
        title="Cancel this run"
      >
        {isCancelling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ── StalePRRow ─────────────────────────────────────────────────────────────────

function StalePRRow({ pr }: { pr: RepoPullRequest }) {
  const repoName = pr.repoFullName.split("/")[1] ?? pr.repoFullName;
  const staleDays = Math.floor(
    (Date.now() - new Date(pr.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.015] transition-colors group"
    >
      {pr.authorAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pr.authorAvatarUrl}
          alt={pr.authorLogin}
          className="h-5 w-5 rounded-full shrink-0 opacity-70"
        />
      ) : (
        <div className="h-5 w-5 rounded-full bg-muted/40 shrink-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
          {pr.authorLogin.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate group-hover:text-foreground transition-colors">
          {pr.title}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
          {repoName} #{pr.number}
        </p>
      </div>
      <span className="text-[11px] text-warning/70 tabular-nums shrink-0 font-medium">
        {staleDays}d old
      </span>
    </a>
  );
}

// ── ShippedReleaseRow ──────────────────────────────────────────────────────────

function ShippedReleaseRow({
  release,
  repoName,
}: {
  release: Release;
  repoName: string | null;
}) {
  return (
    <a
      href={release.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.015] transition-colors group"
    >
      <Tag className="h-3.5 w-3.5 text-success/60 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium font-mono truncate group-hover:text-foreground transition-colors">
          {release.tagName}
        </p>
        {repoName && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{repoName}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {release.prerelease && (
          <span className="text-[9px] border border-warning/30 text-warning/70 rounded px-1 py-0.5">
            pre
          </span>
        )}
        <span className="text-[11px] text-muted-foreground/50 tabular-nums">
          {timeAgo(release.publishedAt)}
        </span>
      </div>
    </a>
  );
}
