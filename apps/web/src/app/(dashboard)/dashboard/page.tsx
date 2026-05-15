"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle,
  GitBranch,
} from "lucide-react";
import { getProfile, getWorkflowRuns, getAuditLog, getRepositories } from "@/lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";
import type { AuditEntry } from "@/lib/api-client";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export default function DashboardPage() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 30_000,
  });

  const { data: runData } = useQuery({
    queryKey: ["workflows", undefined, 1],
    queryFn: () => getWorkflowRuns({ perPage: 6 }),
    staleTime: 15_000,
  });

  const { data: reposData } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-log", 1],
    queryFn: () => getAuditLog(1),
    staleTime: 30_000,
  });

  const runs = runData?.items ?? [];
  const recentAudit = auditData?.items.slice(0, 9) ?? [];
  const repoMap = new Map(reposData?.map((r) => [r.id, r.fullName]) ?? []);
  const liveRuns = runs.filter((r) => r.status === "in_progress");

  const stats = profile?.stats;
  const successRate =
    stats?.workflowSuccessRate != null ? Math.round(stats.workflowSuccessRate) : null;

  const rateColor =
    successRate == null
      ? "text-foreground"
      : successRate >= 80
        ? "text-success"
        : successRate >= 50
          ? "text-warning"
          : "text-destructive";

  return (
    <div className="space-y-8">

      {liveRuns.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </span>
          <span className="text-sm font-medium text-warning">
            {liveRuns.length} workflow{liveRuns.length !== 1 ? "s" : ""} running
          </span>
          <Link
            href="/workflows?status=in_progress"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View live <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
        <StatBlock label="Repositories"    subtitle="tracked"   value={stats?.repositoryCount ?? 0} href="/repositories" icon={GitBranch} />
        <StatBlock label="Total Runs"      subtitle="all time"  value={stats?.totalRuns ?? 0}       href="/workflows"    icon={Activity} />
        <StatBlock label="CI Success Rate" subtitle="all time"  value={successRate != null ? `${successRate}%` : "—"} href="/analytics" icon={CheckCircle2} valueClass={rateColor} />
        <StatBlock label="Failed Runs"     subtitle="all time"  value={stats?.failureCount ?? 0}    href="/workflows"    icon={XCircle}   valueClass={(stats?.failureCount ?? 0) > 0 ? "text-destructive" : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent Runs</h2>
            <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              All runs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Activity className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No workflow runs yet</p>
                <p className="mt-1 text-xs text-muted-foreground/50">Trigger a workflow to see activity here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} repoName={repoMap.get(run.repositoryId) ?? null} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          {successRate !== null && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Success Rate
              </p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className={`text-5xl font-black tabular-nums leading-none ${rateColor}`}>
                  {successRate}
                </span>
                <span className="text-xl font-bold text-muted-foreground/60">%</span>
              </div>
              {stats && stats.totalRuns > 0 && (
                <>
                  <div className="h-1 rounded-full overflow-hidden bg-muted/40 flex mb-2.5">
                    <div className="h-full bg-success transition-all" style={{ width: `${(stats.successCount / stats.totalRuns) * 100}%` }} />
                    <div className="h-full bg-destructive/70" style={{ width: `${(stats.failureCount / stats.totalRuns) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                      {stats.successCount.toLocaleString()} passed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive/70 inline-block" />
                      {stats.failureCount.toLocaleString()} failed
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Activity</h2>
              <Link href="/audit-log" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                Full log <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recentAudit.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity.</p>
            ) : (
              <div className="space-y-3.5">
                {recentAudit.map((entry) => <AuditItem key={entry.id} entry={entry} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label, subtitle, value, icon: Icon, href, valueClass,
}: {
  label: string; subtitle?: string | undefined; value: number | string; icon: React.ElementType; href: string; valueClass?: string | undefined;
}) {
  return (
    <Link href={href} className="flex flex-col gap-2 bg-card px-5 py-4 hover:bg-accent/30 transition-colors group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{subtitle}</p>}
        </div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
      <p className={`text-3xl font-black tabular-nums leading-none ${valueClass ?? "text-foreground"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </Link>
  );
}

function RunRow({ run, repoName }: { run: WorkflowRun; repoName: string | null }) {
  const isRunning = run.status === "in_progress";
  const isSuccess = run.conclusion === "success";
  const isFailed = run.conclusion === "failure" || run.conclusion === "timed_out";
  const dot = isRunning ? "bg-warning" : isSuccess ? "bg-success" : isFailed ? "bg-destructive" : "bg-muted-foreground/30";
  const repoShort = repoName ? (repoName.split("/")[1] ?? repoName) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
      <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
        {isRunning && <span className={`animate-ping absolute h-full w-full rounded-full ${dot} opacity-75`} />}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-snug">{run.workflowName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
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
      <div className="flex items-center gap-2.5 shrink-0 text-xs text-muted-foreground">
        {run.durationMs != null && <span className="tabular-nums">{formatDuration(run.durationMs)}</span>}
        <span className="tabular-nums">{timeAgo(run.startedAt)}</span>
        <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer" className="opacity-30 hover:opacity-100 transition-opacity" aria-label="Open in GitHub">↗</a>
      </div>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  "repository.synced_first":        "New repo synced",
  "repository.synced_with_changes": "Repo updated",
  "repository.privatized":          "Repo privatized",
  "repository.publicized":          "Repo made public",
  "secret.upserted":                "Secret set",
  "secret.deleted":                 "Secret deleted",
  "workflow_run.rerun":             "Workflow re-run",
  "workflow_run.cancelled":         "Workflow cancelled",
  "installation.created":           "App installed",
  "installation.deleted":           "App removed",
};

function AuditItem({ entry }: { entry: AuditEntry }) {
  const label = AUDIT_LABELS[entry.action] ?? entry.action;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/25 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground/80 leading-snug">{label}</p>
        {entry.resourceId && (
          <p className="text-[11px] text-muted-foreground/60 font-mono truncate">{entry.resourceId}</p>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/50 shrink-0 whitespace-nowrap">{timeAgo(entry.createdAt)}</p>
    </div>
  );
}
