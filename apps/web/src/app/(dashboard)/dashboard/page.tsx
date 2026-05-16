"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Lock,
  MessageSquare,
  RotateCcw,
  Tag,
  Users,
} from "lucide-react";
import { getWorkflowRuns, getRepositories, getPullRequests, getReleases } from "@/lib/api-client";
import type { Repository, WorkflowRun, WorkflowRunConclusion, RepoPullRequest } from "@gitvisor/shared";
import { InstallAccountsPanel } from "@/components/install-accounts-panel";
import { useAccount } from "@/lib/account-context";

// ── helpers ───────────────────────────────────────────────────────────────────

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

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Go: "#00ADD8",
  Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d", C: "#555555",
  "C#": "#178600", Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138",
  Kotlin: "#A97BFF", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c",
  Vue: "#41b883", Svelte: "#ff3e00",
};

function conclusionBg(c: WorkflowRunConclusion, status: string): string {
  if (status === "in_progress") return "bg-warning";
  if (c === "success") return "bg-success";
  if (c === "failure" || c === "timed_out") return "bg-destructive";
  if (c === "cancelled") return "bg-muted-foreground/40";
  return "bg-muted/30";
}

// ── types ─────────────────────────────────────────────────────────────────────

interface RepoRow {
  repo: Repository;
  lastRun: WorkflowRun | null;
  last5: WorkflowRun[];
  isLive: boolean;
  failingOnMain: boolean;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { selected: selectedAccount } = useAccount();

  const { data: runData } = useQuery({
    queryKey: ["workflows", undefined, 1],
    queryFn: () => getWorkflowRuns({ perPage: 30 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: reposData } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const { data: pullRequests = [], isLoading: prsLoading } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(50),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const { data: releasesData } = useQuery({
    queryKey: ["releases", undefined, 1],
    queryFn: () => getReleases({ perPage: 6 }),
    staleTime: 60_000,
  });

  const allRuns = runData?.items ?? [];
  const allRepos = reposData ?? [];
  const recentReleases = releasesData?.items ?? [];

  // Scope to selected account
  const scopedRepos = selectedAccount
    ? allRepos.filter((r) =>
        r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"),
      )
    : allRepos;

  const scopedRepoIds = new Set(scopedRepos.map((r) => r.id));

  const scopedRuns = selectedAccount
    ? allRuns.filter((r) => scopedRepoIds.has(r.repositoryId))
    : allRuns;

  const scopedPRs = selectedAccount
    ? pullRequests.filter((pr) =>
        pr.repoFullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"),
      )
    : pullRequests;

  // Index runs by repo
  const runsPerRepo = new Map<string, WorkflowRun[]>();
  for (const run of scopedRuns) {
    const arr = runsPerRepo.get(run.repositoryId) ?? [];
    arr.push(run);
    runsPerRepo.set(run.repositoryId, arr);
  }

  // Per-repo rows with CI context
  const repoRows: RepoRow[] = scopedRepos
    .map((repo) => {
      const raw = runsPerRepo.get(repo.id) ?? [];
      const sorted = [...raw].sort(
        (a, b) =>
          new Date(b.startedAt ?? b.createdAt).getTime() -
          new Date(a.startedAt ?? a.createdAt).getTime(),
      );
      const lastRun = sorted[0] ?? null;
      const last5 = sorted.slice(0, 5);
      const isLive = lastRun?.status === "in_progress";
      const failingOnMain =
        lastRun?.branch === repo.defaultBranch &&
        (lastRun.conclusion === "failure" || lastRun.conclusion === "timed_out");
      return { repo, lastRun, last5, isLive, failingOnMain };
    })
    .sort((a, b) => {
      if (a.failingOnMain !== b.failingOnMain) return a.failingOnMain ? -1 : 1;
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      const aTime = a.lastRun?.startedAt ?? a.repo.pushedAt ?? a.repo.createdAt;
      const bTime = b.lastRun?.startedAt ?? b.repo.pushedAt ?? b.repo.createdAt;
      return bTime.localeCompare(aTime);
    });

  // Release map: repoId → latest release
  const latestReleaseByRepo = new Map(
    recentReleases.map((r) => [r.repositoryId, r]),
  );

  // Situational counts
  const liveCount = scopedRuns.filter((r) => r.status === "in_progress").length;
  const failingMainCount = repoRows.filter((x) => x.failingOnMain).length;
  const totalPRs = scopedPRs.length;
  const totalIssues = scopedRepos.reduce((s, r) => s + r.openIssuesCount, 0);
  const blockingDeploy = repoRows.filter((x) => x.failingOnMain).slice(0, 5);

  // PR priority: needs review → non-draft → draft
  const sortedPRs = [...scopedPRs].sort((a, b) => {
    const aScore = a.requestedReviewersCount > 0 ? 0 : a.draft ? 2 : 1;
    const bScore = b.requestedReviewersCount > 0 ? 0 : b.draft ? 2 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const repoMap = new Map(allRepos.map((r) => [r.id, r.fullName]));
  const recentRuns = scopedRuns.slice(0, 8);
  const hasData = scopedRepos.length > 0;

  return (
    <div className="space-y-5">

      {/* ── Status strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          liveCount > 0
            ? "border-warning/30 bg-warning/[0.08] text-warning"
            : "border-border bg-card text-muted-foreground"
        }`}>
          {liveCount > 0 ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute h-full w-full rounded-full bg-warning opacity-75" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-warning" />
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          )}
          {liveCount > 0 ? `${liveCount} running now` : "Nothing running"}
        </div>

        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          failingMainCount > 0
            ? "border-destructive/30 bg-destructive/[0.08] text-destructive"
            : hasData
              ? "border-success/20 bg-success/[0.08] text-success"
              : "border-border bg-card text-muted-foreground"
        }`}>
          {failingMainCount > 0
            ? <AlertTriangle className="h-3 w-3 shrink-0" />
            : <CheckCircle2 className="h-3 w-3 shrink-0" />}
          {failingMainCount > 0
            ? `${failingMainCount} broken on main`
            : hasData ? "All main branches green" : "No repos tracked"}
        </div>

        {totalPRs > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-blue/20 bg-blue/[0.06] px-3 py-1.5 text-xs font-medium text-blue">
            <GitPullRequest className="h-3 w-3 shrink-0" />
            {totalPRs} open PR{totalPRs !== 1 ? "s" : ""}
          </div>
        )}

        {totalIssues > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <CircleDot className="h-3 w-3 shrink-0" />
            {totalIssues} open issue{totalIssues !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Repo table */}
        <div className="col-span-2 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Your Repositories</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                CI · open PRs · issues · last push — one view
              </p>
            </div>
            <Link href="/repositories" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors shrink-0">
              All repos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {repoRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <GitBranch className="h-7 w-7 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No repositories tracked</p>
                <p className="mt-1 text-xs text-muted-foreground/50">Sync your repos to see them here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {repoRows.slice(0, 12).map(({ repo, lastRun, last5, isLive, failingOnMain }) => (
                  <RepoTableRow
                    key={repo.id}
                    repo={repo}
                    lastRun={lastRun}
                    last5={last5}
                    isLive={isLive}
                    failingOnMain={failingOnMain}
                    latestRelease={latestReleaseByRepo.get(repo.id) ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4 min-w-0">
          <InstallAccountsPanel />

          {blockingDeploy.length > 0 && (
            <div className="rounded-xl border border-destructive/20 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-destructive/15">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <h3 className="text-sm font-semibold text-destructive">Blocking deployment</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  CI failing on main — cannot safely deploy
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {blockingDeploy.map(({ repo, lastRun }) => (
                  <div key={repo.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{repo.name}</p>
                      {lastRun && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {lastRun.workflowName} · {timeAgo(lastRun.startedAt)}
                        </p>
                      )}
                    </div>
                    {lastRun?.htmlUrl && (
                      <a href={lastRun.htmlUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors mt-0.5">
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Open Pull Requests ─────────────────────────────────────────── */}
      {(sortedPRs.length > 0 || prsLoading) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                Open Pull Requests
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All open PRs across every tracked repo
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {prsLoading ? (
              <div className="divide-y divide-border/50">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="h-5 w-5 rounded-full bg-muted/40 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-64 bg-muted/40 rounded" />
                      <div className="h-2.5 w-40 bg-muted/25 rounded" />
                    </div>
                    <div className="h-2.5 w-12 bg-muted/25 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {sortedPRs.slice(0, 15).map((pr) => (
                  <PRRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recent CI feed + Latest Releases ──────────────────────────── */}
      <div className={`grid gap-5 ${recentReleases.length > 0 ? "grid-cols-3" : "grid-cols-1"}`}>

        {/* CI runs feed */}
        {recentRuns.length > 0 && (
          <div className={recentReleases.length > 0 ? "col-span-2" : ""}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent CI Runs</h2>
              <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                All runs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
              {recentRuns.map((run) => (
                <RunRow key={run.id} run={run} repoName={repoMap.get(run.repositoryId) ?? null} />
              ))}
            </div>
          </div>
        )}

        {/* Latest releases */}
        {recentReleases.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                Latest Releases
              </h2>
              <Link href="/releases" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
              {recentReleases.map((release) => {
                const repoName = repoMap.get(release.repositoryId);
                const short = repoName?.split("/")[1] ?? repoName;
                return (
                  <a
                    key={release.id}
                    href={release.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.015] transition-colors"
                  >
                    <Tag className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{release.tagName}</p>
                      {short && (
                        <p className="text-[11px] text-muted-foreground truncate">{short}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {release.prerelease && (
                        <span className="text-[9px] border border-warning/30 text-warning/70 rounded px-1 py-0.5">pre</span>
                      )}
                      {release.draft && (
                        <span className="text-[9px] border border-border text-muted-foreground/50 rounded px-1 py-0.5">draft</span>
                      )}
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                        {timeAgo(release.publishedAt)}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── RepoTableRow ──────────────────────────────────────────────────────────────

function RepoTableRow({
  repo, lastRun, last5, isLive, failingOnMain, latestRelease,
}: RepoRow & { latestRelease: import("@gitvisor/shared").Release | null }) {
  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? "#555") : "#333";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors ${
      failingOnMain ? "border-l-2 border-l-destructive/60" : ""
    }`}>
      <span
        className="h-2 w-2 rounded-full shrink-0 mt-0.5"
        style={{ background: langColor }}
        title={repo.language ?? "Unknown language"}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium truncate">{repo.name}</span>
          {repo.private && <Lock className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />}
          {repo.archived && (
            <span className="text-[9px] text-muted-foreground/40 border border-border/50 rounded px-1 shrink-0">archived</span>
          )}
        </div>

        {!lastRun ? (
          <p className="text-[11px] text-muted-foreground/35 mt-0.5">No CI runs</p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              {isLive && (
                <span className={`animate-ping absolute h-full w-full rounded-full ${conclusionBg(lastRun.conclusion, lastRun.status)} opacity-75`} />
              )}
              <span className={`relative h-1.5 w-1.5 rounded-full ${conclusionBg(lastRun.conclusion, lastRun.status)}`} />
            </span>
            <span className="truncate">{lastRun.workflowName}</span>
            <span className="opacity-40 shrink-0">·</span>
            <span className="font-mono shrink-0 truncate max-w-[80px]">{lastRun.branch}</span>
            <span className="opacity-40 shrink-0">·</span>
            <span className="shrink-0">{timeAgo(lastRun.startedAt)}</span>
            {lastRun.durationMs != null && (
              <>
                <span className="opacity-40 shrink-0">·</span>
                <span className="shrink-0">{formatDuration(lastRun.durationMs)}</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Mini CI history bar */}
      <div className="flex items-center gap-0.5 shrink-0" title="Last 5 CI runs (newest first)">
        {last5.map((run, i) => (
          <span key={i} className={`h-[14px] w-[5px] rounded-sm ${conclusionBg(run.conclusion, run.status)} opacity-80`} />
        ))}
        {Array.from({ length: Math.max(0, 5 - last5.length) }).map((_, i) => (
          <span key={`e${i}`} className="h-[14px] w-[5px] rounded-sm bg-muted/20" />
        ))}
      </div>

      {/* Latest release tag */}
      {latestRelease && (
        <a
          href={latestRelease.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] text-muted-foreground/50 hover:text-muted-foreground font-mono transition-colors flex items-center gap-1"
          title={`Latest release: ${latestRelease.tagName}`}
        >
          <Tag className="h-2.5 w-2.5" />
          {latestRelease.tagName}
        </a>
      )}

      {/* PR · Issues · Pushed */}
      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
        {repo.openPullsCount > 0 && (
          <span className="flex items-center gap-1" title="Open pull requests">
            <GitPullRequest className="h-3 w-3" />
            {repo.openPullsCount}
          </span>
        )}
        {repo.openIssuesCount > 0 && (
          <span className="flex items-center gap-1" title="Open issues">
            <CircleDot className="h-3 w-3" />
            {repo.openIssuesCount}
          </span>
        )}
        <span className="tabular-nums opacity-50" title="Last pushed">
          {timeAgo(repo.pushedAt)}
        </span>
      </div>
    </div>
  );
}

// ── PRRow ─────────────────────────────────────────────────────────────────────

function PRRow({ pr }: { pr: RepoPullRequest }) {
  const repoName = pr.repoFullName.split("/")[1] ?? pr.repoFullName;
  const isStale = Date.now() - new Date(pr.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000;

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.015] transition-colors group"
    >
      {/* Author avatar */}
      {pr.authorAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pr.authorAvatarUrl} alt={pr.authorLogin} className="h-5 w-5 rounded-full shrink-0 opacity-80" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-muted/40 shrink-0 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
          {pr.authorLogin.slice(0, 1).toUpperCase()}
        </div>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {pr.draft && (
            <span className="text-[9px] border border-border text-muted-foreground/50 rounded px-1 py-0.5 shrink-0">draft</span>
          )}
          {pr.requestedReviewersCount > 0 && (
            <span className="text-[9px] border border-blue/30 text-blue/70 bg-blue/5 rounded px-1 py-0.5 shrink-0 flex items-center gap-0.5">
              <Users className="h-2 w-2" /> review
            </span>
          )}
          {isStale && !pr.draft && (
            <span className="text-[9px] border border-warning/30 text-warning/70 rounded px-1 py-0.5 shrink-0">stale</span>
          )}
          <p className="text-xs font-medium truncate group-hover:text-foreground transition-colors">
            {pr.title}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
          <span className="font-mono">{repoName}</span>
          <span className="opacity-40">·</span>
          <span className="truncate">
            <GitMerge className="h-2.5 w-2.5 inline-block mr-0.5 -mt-0.5 opacity-50" />
            {pr.baseRef}
            <span className="opacity-40 mx-1">←</span>
            {pr.headRef}
          </span>
        </p>
      </div>

      {/* Right meta */}
      <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
        {pr.commentsCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {pr.commentsCount}
          </span>
        )}
        {pr.requestedReviewersCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {pr.requestedReviewersCount}
          </span>
        )}
        <span className="tabular-nums">{timeAgo(pr.updatedAt)}</span>
      </div>
    </a>
  );
}

// ── RunRow ────────────────────────────────────────────────────────────────────

function RunRow({ run, repoName }: { run: WorkflowRun; repoName: string | null }) {
  const isRunning = run.status === "in_progress";
  const repoShort = repoName ? (repoName.split("/")[1] ?? repoName) : null;
  const dotClass = conclusionBg(run.conclusion, run.status);
  const isRetry = run.runAttempt > 1;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.015] transition-colors">
      <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
        {isRunning && <span className={`animate-ping absolute h-full w-full rounded-full ${dotClass} opacity-75`} />}
        <span className={`relative h-2 w-2 rounded-full ${dotClass}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-snug">
          {run.workflowName}
          {isRetry && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-warning/70">
              <RotateCcw className="h-2.5 w-2.5" /> #{run.runAttempt}
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
          {repoShort && <span className="font-mono">{repoShort}</span>}
          {repoShort && <span className="opacity-40">·</span>}
          <span className="truncate">{run.branch}</span>
          {run.commitSha && (
            <>
              <span className="opacity-40 shrink-0">·</span>
              <span className="font-mono shrink-0">{run.commitSha.slice(0, 7)}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0 text-[11px] text-muted-foreground">
        {run.durationMs != null && <span className="tabular-nums">{formatDuration(run.durationMs)}</span>}
        <span className="tabular-nums">{timeAgo(run.startedAt)}</span>
        {run.htmlUrl && (
          <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer"
            className="opacity-30 hover:opacity-100 transition-opacity" aria-label="Open in GitHub">
            ↗
          </a>
        )}
      </div>
    </div>
  );
}
