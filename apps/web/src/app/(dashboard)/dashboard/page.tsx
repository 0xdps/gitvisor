"use client";

import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Activity,
  Boxes,
  Clock,
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  KeyRound,
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
  getAnalytics,
  getSecrets,
  getPackages,
  getAuditLog,
  rerunWorkflow,
  cancelWorkflow,
} from "@/lib/api-client";
import type { RepoPullRequest, Repository, WorkflowRun } from "@gitvisor/shared";
import { useAccount } from "@/lib/account-context";
import { InstallAccountsPanel } from "@/components/install-accounts-panel";
import { PageHeader } from "@/components/page-header";
import { DomainPanel, Meter, SparkBars, type Tone } from "@/components/ops/domain-panel";
import { RepoMatrix, type CiState, type RepoRow } from "@/components/ops/repo-matrix";
import { ActivityFeed, type ActivityItem } from "@/components/ops/activity-feed";
import { AttentionInbox, type AttentionItem } from "@/components/ops/attention-inbox";
import { ageInDays, formatDuration, timeAgo } from "@/lib/format";

const STALE_PR_HOURS = 48;
const STALE_SECRET_DAYS = 180;
const DAY = 86_400_000;

function runTime(run: WorkflowRun): number {
  return new Date(run.startedAt ?? run.createdAt).getTime();
}

function isFailure(run: WorkflowRun): boolean {
  return run.status === "completed" && (run.conclusion === "failure" || run.conclusion === "timed_out");
}

export default function OpsCenterPage() {
  const { selected: selectedAccount } = useAccount();
  const queryClient = useQueryClient();

  const { data: runData } = useQuery({
    queryKey: ["workflows", "ops", 100],
    queryFn: () => getWorkflowRuns({ perPage: 100 }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const { data: allRepos = [] } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });
  const { data: pullRequests = [] } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(100),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
  const { data: releasesData } = useQuery({
    queryKey: ["releases", "ops"],
    queryFn: () => getReleases({ perPage: 100 }),
    staleTime: 60_000,
  });
  const { data: analytics } = useQuery({
    queryKey: ["analytics", 30],
    queryFn: () => getAnalytics(30),
    staleTime: 60_000,
  });
  const { data: allSecrets = [] } = useQuery({
    queryKey: ["secrets", undefined],
    queryFn: () => getSecrets(),
    staleTime: 60_000,
  });
  const { data: allPackages = [] } = useQuery({
    queryKey: ["packages", undefined],
    queryFn: () => getPackages(),
    staleTime: 60_000,
  });
  const { data: audit } = useQuery({
    queryKey: ["audit-log", 1],
    queryFn: () => getAuditLog(1),
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

  const ownerPrefix = selectedAccount ? selectedAccount.login.toLowerCase() + "/" : null;

  const repos = useMemo(
    () => (ownerPrefix ? allRepos.filter((r) => r.fullName.toLowerCase().startsWith(ownerPrefix)) : allRepos),
    [allRepos, ownerPrefix],
  );
  const repoIds = useMemo(() => new Set(repos.map((r) => r.id)), [repos]);
  const repoById = useMemo(() => new Map(allRepos.map((r) => [r.id, r])), [allRepos]);

  const runs = useMemo(
    () => (runData?.items ?? []).filter((r) => repoIds.has(r.repositoryId)),
    [runData, repoIds],
  );
  const prs = useMemo(
    () => (ownerPrefix ? pullRequests.filter((p) => p.repoFullName.toLowerCase().startsWith(ownerPrefix)) : pullRequests),
    [pullRequests, ownerPrefix],
  );
  const releases = useMemo(
    () => (releasesData?.items ?? []).filter((r) => repoIds.has(r.repositoryId) && !r.draft),
    [releasesData, repoIds],
  );
  const secrets = useMemo(() => allSecrets.filter((s) => repoIds.has(s.repositoryId)), [allSecrets, repoIds]);
  const packages = useMemo(
    () => allPackages.filter((p) => (p.repositoryId ? repoIds.has(p.repositoryId) : !ownerPrefix)),
    [allPackages, repoIds, ownerPrefix],
  );
  const byRepo = useMemo(
    () => (analytics?.byRepo ?? []).filter((r) => repoIds.has(r.repositoryId)),
    [analytics, repoIds],
  );

  // ── Per-repo state ──────────────────────────────────────────────────────────
  const { rows, failing, inFlight } = useMemo(() => {
    const runsByRepo = new Map<string, WorkflowRun[]>();
    for (const run of runs) {
      const list = runsByRepo.get(run.repositoryId) ?? [];
      list.push(run);
      runsByRepo.set(run.repositoryId, list);
    }
    const prsByRepo = new Map<string, RepoPullRequest[]>();
    for (const pr of prs) {
      const list = prsByRepo.get(pr.repoId) ?? [];
      list.push(pr);
      prsByRepo.set(pr.repoId, list);
    }
    const statsByRepo = new Map(byRepo.map((r) => [r.repositoryId, r]));

    const failing: { repo: Repository; run: WorkflowRun }[] = [];
    const rows: RepoRow[] = repos.map((repo) => {
      const repoRuns = (runsByRepo.get(repo.id) ?? []).sort((a, b) => runTime(b) - runTime(a));
      const mainRuns = repoRuns.filter((r) => r.branch === repo.defaultBranch);
      const lastMain = mainRuns.find((r) => r.status === "completed") ?? null;
      const live = repoRuns.some((r) => r.status === "in_progress" || r.status === "queued");

      let ci: CiState = "none";
      if (lastMain && isFailure(lastMain)) ci = "failing";
      else if (live) ci = "running";
      else if (lastMain) ci = "passing";
      if (ci === "failing" && lastMain && !repo.locked) failing.push({ repo, run: lastMain });

      const stats = statsByRepo.get(repo.id);
      const repoPrs = prsByRepo.get(repo.id) ?? [];
      const stalePrs = repoPrs.filter(
        (p) => !p.draft && Date.now() - new Date(p.updatedAt).getTime() > STALE_PR_HOURS * 3_600_000,
      ).length;
      const repoSecrets = secrets.filter((s) => s.repositoryId === repo.id);
      const staleSecrets = repoSecrets.filter(
        (s) => ageInDays(s.githubUpdatedAt ?? s.updatedAt) > STALE_SECRET_DAYS,
      ).length;
      const latest = releases
        .filter((r) => r.repositoryId === repo.id)
        .sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime())[0];
      const successRate = stats && stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null;

      const score = repo.locked
        ? 0
        : (ci === "failing" ? 100 : 0) +
          (successRate != null && successRate < 80 ? 20 : 0) +
          stalePrs * 5 +
          staleSecrets * 3 +
          (ci === "running" ? 1 : 0);
      const reasons = [
        repo.locked ? "Locked by the current plan" : null,
        ci === "failing" && lastMain ? `${lastMain.workflowName} failed on ${repo.defaultBranch}` : null,
        successRate != null && successRate < 80 ? `${successRate}% of runs passed in 30 days` : null,
        stalePrs > 0 ? `${stalePrs} pull request${stalePrs === 1 ? "" : "s"} idle over 48h` : null,
        staleSecrets > 0 ? `${staleSecrets} secret${staleSecrets === 1 ? "" : "s"} older than 180 days` : null,
      ].filter((reason): reason is string => Boolean(reason));

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        private: repo.private,
        locked: Boolean(repo.locked),
        ci,
        ciWorkflow: lastMain?.workflowName ?? null,
        lastRunAt: repoRuns[0] ? (repoRuns[0].startedAt ?? repoRuns[0].createdAt) : null,
        successRate,
        runs30d: stats?.total ?? 0,
        openPrs: prsByRepo.has(repo.id) ? repoPrs.length : repo.openPullsCount,
        stalePrs,
        openIssues: Math.max(0, repo.openIssuesCount - repo.openPullsCount),
        latestRelease: latest ? { tag: latest.tagName, at: latest.publishedAt } : null,
        secrets: repoSecrets.length,
        staleSecrets,
        packages: packages.filter((p) => p.repositoryId === repo.id).length,
        pushedAt: repo.pushedAt,
        score,
        reasons,
      };
    });

    rows.sort((a, b) => b.score - a.score || (new Date(b.pushedAt ?? 0).getTime() - new Date(a.pushedAt ?? 0).getTime()));
    failing.sort((a, b) => runTime(b.run) - runTime(a.run));

    const inFlight = runs
      .filter((r) => (r.status === "in_progress" || r.status === "queued") && !repoById.get(r.repositoryId)?.locked)
      .sort((a, b) => runTime(a) - runTime(b));

    return { rows, failing, inFlight };
  }, [repos, runs, prs, byRepo, secrets, releases, packages, repoById]);

  // ── Domain summaries ────────────────────────────────────────────────────────
  const ci = useMemo(() => {
    const total = byRepo.reduce((s, r) => s + r.total, 0);
    const success = byRepo.reduce((s, r) => s + r.success, 0);
    const failure = byRepo.reduce((s, r) => s + r.failure, 0);
    const dayMap = new Map((analytics?.byDay ?? []).map((d) => [d.date, d]));
    const days: { total: number; good: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
      const d = dayMap.get(key);
      days.push({ total: d?.total ?? 0, good: d?.success ?? 0, label: key });
    }
    const durations = runs.filter((r) => r.durationMs).map((r) => r.durationMs!);
    const avg = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;
    return {
      total,
      failure,
      rate: total > 0 ? Math.round((success / total) * 100) : null,
      days,
      avg,
    };
  }, [byRepo, analytics, runs]);

  const prSummary = useMemo(() => {
    const drafts = prs.filter((p) => p.draft).length;
    const stale = prs.filter(
      (p) => !p.draft && Date.now() - new Date(p.updatedAt).getTime() > STALE_PR_HOURS * 3_600_000,
    );
    const awaitingReview = prs.filter((p) => !p.draft && p.requestedReviewersCount > 0).length;
    const oldest = [...prs].filter((p) => !p.draft).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    return { drafts, stale, awaitingReview, oldest };
  }, [prs]);

  const releaseSummary = useMemo(() => {
    const week = releases.filter((r) => r.publishedAt && Date.now() - new Date(r.publishedAt).getTime() < 7 * DAY);
    const latest = [...releases].sort(
      (a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime(),
    )[0];
    const reposWithRelease = new Set(releases.map((r) => r.repositoryId)).size;
    return { week: week.length, latest, reposWithRelease, pre: week.filter((r) => r.prerelease).length };
  }, [releases]);

  const secretSummary = useMemo(() => {
    const stale = secrets.filter((s) => ageInDays(s.githubUpdatedAt ?? s.updatedAt) > STALE_SECRET_DAYS).length;
    const oldest = secrets.reduce((max, s) => Math.max(max, ageInDays(s.githubUpdatedAt ?? s.updatedAt)), 0);
    const reposWith = new Set(secrets.map((s) => s.repositoryId)).size;
    return { stale, oldest, reposWith };
  }, [secrets]);

  const packageSummary = useMemo(() => {
    const byEco = new Map<string, number>();
    for (const p of packages) byEco.set(p.ecosystem, (byEco.get(p.ecosystem) ?? 0) + 1);
    const latest = [...packages].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    return {
      eco: [...byEco.entries()].sort((a, b) => b[1] - a[1]),
      latest,
      privateCount: packages.filter((p) => p.visibility === "private").length,
    };
  }, [packages]);

  const repoSummary = useMemo(() => {
    const priv = repos.filter((r) => r.private && !r.locked).length;
    const locked = repos.filter((r) => r.locked).length;
    const quiet = repos.filter((r) => ageInDays(r.pushedAt) > 30).length;
    const issues = repos.reduce((s, r) => s + Math.max(0, r.openIssuesCount - r.openPullsCount), 0);
    return { priv, locked, pub: repos.length - priv - locked, quiet, issues };
  }, [repos]);

  // ── Activity ────────────────────────────────────────────────────────────────
  const activity = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];
    for (const run of runs.slice(0, 40)) {
      const repo = repoById.get(run.repositoryId);
      const live = run.status !== "completed";
      items.push({
        id: `run-${run.id}`,
        at: run.completedAt ?? run.startedAt ?? run.createdAt,
        kind: live ? "run-live" : isFailure(run) ? "run-fail" : "run-pass",
        title: `${run.workflowName} ${live ? "running" : isFailure(run) ? "failed" : run.conclusion === "success" ? "passed" : (run.conclusion ?? "finished")}`,
        detail: `${repo?.name ?? "repo"} · ${run.branch} · ${run.commitSha.slice(0, 7)}`,
        href: run.htmlUrl,
      });
    }
    for (const rel of releases.slice(0, 20)) {
      items.push({
        id: `rel-${rel.id}`,
        at: rel.publishedAt ?? rel.createdAt,
        kind: "release",
        title: `Released ${rel.tagName}${rel.prerelease ? " (pre-release)" : ""}`,
        detail: repoById.get(rel.repositoryId)?.name ?? "repo",
        href: rel.htmlUrl,
      });
    }
    for (const entry of audit?.items ?? []) {
      items.push({
        id: `audit-${entry.id}`,
        at: entry.createdAt,
        kind: "action",
        title: entry.action.replace(/[._]/g, " "),
        detail: `${entry.resourceType} · ${entry.resourceId}`,
      });
    }
    return items
      .filter((item) => item.kind !== "run-pass")
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30);
  }, [runs, releases, audit, repoById]);

  // ── Verdict ─────────────────────────────────────────────────────────────────
  const hasData = repos.length > 0;
  const warningCount = rows.filter((row) => row.reasons.some((reason) => !reason.startsWith("Locked") && !reason.includes("failed on"))).length + rows.filter((row) => row.locked).length;
  const verdict = !hasData
    ? "Connect GitHub to fill the board"
    : `${failing.length} blocker${failing.length === 1 ? "" : "s"} · ${warningCount} warning${warningCount === 1 ? "" : "s"} · ${inFlight.length} running`;

  const summary = [
    `${repos.length} repos`,
    inFlight.length ? `${inFlight.length} running` : null,
    prSummary.stale.length ? `${prSummary.stale.length} PRs waiting over 48h` : null,
    secretSummary.stale ? `${secretSummary.stale} secrets older than ${STALE_SECRET_DAYS} days` : null,
    releaseSummary.week ? `${releaseSummary.week} shipped this week` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const attention = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];
    for (const item of failing) {
      items.push({
        id: `fail-${item.repo.id}`,
        severity: "critical",
        category: "ci",
        repo: item.repo.fullName,
        title: `${item.run.workflowName} failed`,
        reason: `${item.repo.defaultBranch} cannot ship until this passes`,
        when: timeAgo(item.run.completedAt ?? item.run.startedAt),
        href: `/repositories/${item.repo.id}`,
      });
    }
    for (const pr of prSummary.stale.slice(0, 6)) {
      items.push({
        id: `pr-${pr.repoFullName}-${pr.number}`,
        severity: "warning",
        category: "reviews",
        repo: pr.repoFullName,
        title: pr.title,
        reason: `No update for ${timeAgo(pr.updatedAt)} · ${pr.requestedReviewersCount} reviewer${pr.requestedReviewersCount === 1 ? "" : "s"} requested`,
        when: timeAgo(pr.updatedAt),
        href: pr.htmlUrl,
        external: true,
      });
    }
    const staleByName = new Map<string, number>();
    for (const secret of secrets) {
      if (ageInDays(secret.githubUpdatedAt ?? secret.updatedAt) > STALE_SECRET_DAYS) {
        staleByName.set(secret.name, (staleByName.get(secret.name) ?? 0) + 1);
      }
    }
    for (const [name, count] of [...staleByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
      items.push({
        id: `secret-${name}`,
        severity: "warning",
        category: "security",
        repo: `${count} repositor${count === 1 ? "y" : "ies"}`,
        title: name,
        reason: "Older than 180 days. Rotate it once across every repository from Secret groups.",
        when: "180d+",
        href: "/secrets",
      });
    }
    for (const repo of repos.filter((item) => item.locked).slice(0, 3)) {
      items.push({
        id: `locked-${repo.id}`,
        severity: "info",
        category: "setup",
        repo: repo.fullName,
        title: "Private repository is locked",
        reason: "The current plan does not include this repository",
        when: "plan",
        href: "/repositories",
      });
    }
    return items;
  }, [failing, prSummary.stale, secrets, repos]);

  const ciTone: Tone =
    failing.length > 0 ? "bad" : ci.rate == null ? "neutral" : ci.rate < 80 ? "warn" : "good";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          kicker={`Ops Center · ${selectedAccount ? selectedAccount.login : "all accounts"}`}
          title={verdict}
          detail={hasData ? summary : "Install the GitHub App and sync your repositories."}
        />
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${inFlight.length ? "bg-blue animate-pulse" : "bg-success"}`} />
          live · refreshes every 30s
        </div>
      </div>

      {!hasData && (
        <div className="max-w-sm">
          <InstallAccountsPanel />
        </div>
      )}

      <AttentionInbox items={attention} />

      {/* ── Domain panels ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DomainPanel
          icon={Activity}
          label="CI health · 30d"
          href="/analytics"
          value={ci.rate == null ? "—" : `${ci.rate}%`}
          unit={ci.total ? `of ${ci.total.toLocaleString()} runs passed` : "no runs yet"}
          tone={ciTone}
          facts={[
            { label: "Failing on default", value: failing.length, tone: failing.length ? "bad" : "neutral" },
            { label: "Running now", value: inFlight.length, tone: inFlight.length ? "live" : "neutral" },
            { label: "Failed runs · 30d", value: ci.failure, tone: ci.failure ? "warn" : "neutral" },
            { label: "Avg duration", value: ci.avg ? formatDuration(ci.avg) : "—" },
          ]}
        >
          <SparkBars values={ci.days} highlight={13} />
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">last 14 days · red = failed share</p>
        </DomainPanel>

        <DomainPanel
          icon={GitPullRequest}
          label="Pull requests"
          href="/pull-requests"
          value={prs.length}
          unit="open"
          tone={prSummary.stale.length ? "warn" : "neutral"}
          facts={[
            { label: "Waiting over 48h", value: prSummary.stale.length, tone: prSummary.stale.length ? "warn" : "neutral" },
            { label: "Review requested", value: prSummary.awaitingReview },
            { label: "Drafts", value: prSummary.drafts },
            { label: "Oldest open", value: prSummary.oldest ? timeAgo(prSummary.oldest.createdAt) : "—" },
          ]}
        >
          <Meter
            parts={[
              { label: "Stale", value: prSummary.stale.length, className: "bg-warning" },
              { label: "Active", value: prs.length - prSummary.stale.length - prSummary.drafts, className: "bg-blue" },
              { label: "Draft", value: prSummary.drafts, className: "bg-white/20" },
            ]}
          />
        </DomainPanel>

        <DomainPanel
          icon={Tag}
          label="Releases"
          href="/releases"
          value={releaseSummary.week}
          unit="shipped in 7 days"
          tone={releaseSummary.week ? "good" : "neutral"}
          facts={[
            {
              label: "Latest",
              value: releaseSummary.latest
                ? `${repoById.get(releaseSummary.latest.repositoryId)?.name ?? ""} ${releaseSummary.latest.tagName}`
                : "—",
            },
            { label: "Published", value: releaseSummary.latest ? timeAgo(releaseSummary.latest.publishedAt) : "—" },
            { label: "Repos releasing", value: `${releaseSummary.reposWithRelease}/${repos.length}` },
            { label: "Pre-releases · 7d", value: releaseSummary.pre },
          ]}
        />

        <DomainPanel
          icon={KeyRound}
          label="Secrets"
          href="/secrets"
          value={secrets.length}
          unit="tracked (names only)"
          tone={secretSummary.stale ? "warn" : "neutral"}
          facts={[
            {
              label: `Older than ${STALE_SECRET_DAYS}d`,
              value: secretSummary.stale,
              tone: secretSummary.stale ? "warn" : "neutral",
            },
            { label: "Oldest", value: secrets.length ? `${secretSummary.oldest}d` : "—" },
            { label: "Repos with secrets", value: `${secretSummary.reposWith}/${repos.length}` },
            { label: "Rotate from", value: "Secret groups" },
          ]}
        >
          <Meter
            parts={[
              { label: "Overdue", value: secretSummary.stale, className: "bg-warning" },
              { label: "Fresh", value: secrets.length - secretSummary.stale, className: "bg-success/70" },
            ]}
          />
        </DomainPanel>

        <DomainPanel
          icon={Boxes}
          label="Packages"
          href="/packages"
          value={packages.length}
          unit="published"
          facts={[
            { label: "Latest update", value: packageSummary.latest ? packageSummary.latest.name : "—" },
            { label: "Version", value: packageSummary.latest?.latestVersion ?? "—" },
            { label: "Private", value: packageSummary.privateCount },
            { label: "Ecosystems", value: packageSummary.eco.length },
          ]}
        >
          <div className="flex flex-wrap gap-1.5">
            {packageSummary.eco.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No packages found</span>
            ) : (
              packageSummary.eco.slice(0, 4).map(([eco, n]) => (
                <span key={eco} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {eco} {n}
                </span>
              ))
            )}
          </div>
        </DomainPanel>

        <DomainPanel
          icon={FolderGit2}
          label="Repositories"
          href="/repositories"
          value={repos.length}
          unit="tracked"
          tone={repoSummary.locked ? "warn" : "neutral"}
          facts={[
            { label: "Open issues", value: repoSummary.issues },
            { label: "Quiet over 30d", value: repoSummary.quiet },
            { label: "Private", value: repoSummary.priv },
            { label: "Locked by plan", value: repoSummary.locked, tone: repoSummary.locked ? "warn" : "neutral" },
          ]}
        >
          <Meter
            parts={[
              { label: "Public", value: repoSummary.pub, className: "bg-blue" },
              { label: "Private", value: repoSummary.priv, className: "bg-success/70" },
              { label: "Locked", value: repoSummary.locked, className: "bg-warning" },
            ]}
          />
        </DomainPanel>
      </div>

      {/* ── Act now ───────────────────────────────────────────────────────── */}
      {(failing.length > 0 || inFlight.length > 0) && (
        <section className="grid gap-3 lg:grid-cols-2">
          {failing.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Blocking deploys
              </h2>
              {failing.map(({ repo, run }) => (
                <FailingRow
                  key={repo.id}
                  repo={repo}
                  run={run}
                  isRerunning={rerunMutation.isPending && rerunMutation.variables === run.githubRunId}
                  onRerun={() => rerunMutation.mutate(run.githubRunId)}
                />
              ))}
            </div>
          )}
          {inFlight.length > 0 && (
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue" />
                Running now
              </h2>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
                {inFlight.slice(0, 8).map((run) => (
                  <InFlightRow
                    key={run.id}
                    run={run}
                    repo={repoById.get(run.repositoryId) ?? null}
                    isCancelling={cancelMutation.isPending && cancelMutation.variables === run.githubRunId}
                    onCancel={() => cancelMutation.mutate(run.githubRunId)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Repository matrix ─────────────────────────────────────────────── */}
      <RepoMatrix rows={rows} />

      {/* ── Review queue + activity ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Review queue</h2>
            <p className="text-[11px] text-muted-foreground">Open pull requests, oldest untouched first</p>
          </div>
          {prs.filter((p) => !p.draft).length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">No open pull requests.</p>
          ) : (
            <div className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
              {[...prs]
                .filter((p) => !p.draft)
                .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
                .slice(0, 15)
                .map((pr) => (
                  <PrRow key={`${pr.repoFullName}#${pr.number}`} pr={pr} />
                ))}
            </div>
          )}
        </section>
        <ActivityFeed items={activity} />
      </div>
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function FailingRow({
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
    <div className="flex items-center gap-3 rounded-xl border border-destructive/35 bg-destructive/[0.05] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-foreground">{repo.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground">
          {run.workflowName}
          <span className="opacity-40">·</span>
          <GitBranch className="h-3 w-3" />
          {run.branch}
          <span className="opacity-40">·</span>
          {run.commitSha.slice(0, 7)}
          <span className="opacity-40">·</span>
          {timeAgo(run.completedAt ?? run.startedAt)}
          {run.conclusion === "timed_out" && <span className="text-warning">· timed out</span>}
        </p>
      </div>
      <a
        href={run.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground sm:flex"
      >
        Logs <ExternalLink className="h-3 w-3" />
      </a>
      <button
        type="button"
        onClick={onRerun}
        disabled={isRerunning}
        className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isRerunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        Rerun
      </button>
    </div>
  );
}

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
  const elapsed = run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : 0;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{run.workflowName}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {repo?.name ?? "repo"} · {run.branch} · {run.commitSha.slice(0, 7)}
        </p>
      </div>
      <span className="flex items-center gap-1 font-mono text-[11px] text-blue">
        <Clock className="h-3 w-3" />
        {run.status === "queued" ? "queued" : formatDuration(elapsed)}
      </span>
      <button
        type="button"
        onClick={onCancel}
        disabled={isCancelling}
        title="Cancel this run"
        className="text-muted-foreground/50 hover:text-destructive disabled:opacity-50"
      >
        {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function PrRow({ pr }: { pr: RepoPullRequest }) {
  const repoName = pr.repoFullName.split("/")[1] ?? pr.repoFullName;
  const idleHours = (Date.now() - new Date(pr.updatedAt).getTime()) / 3_600_000;
  const stale = idleHours > STALE_PR_HOURS;
  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]"
    >
      {pr.authorAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pr.authorAvatarUrl} alt={pr.authorLogin} className="h-5 w-5 shrink-0 rounded-full" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px]">
          {pr.authorLogin.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-foreground">{pr.title}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {repoName} #{pr.number} · {pr.headRef} → {pr.baseRef}
          {pr.requestedReviewersCount > 0 && ` · ${pr.requestedReviewersCount} reviewer${pr.requestedReviewersCount > 1 ? "s" : ""}`}
        </p>
      </div>
      <span className={`shrink-0 font-mono text-[11px] ${stale ? "text-warning" : "text-muted-foreground"}`}>
        idle {timeAgo(pr.updatedAt).replace(" ago", "")}
      </span>
    </a>
  );
}
