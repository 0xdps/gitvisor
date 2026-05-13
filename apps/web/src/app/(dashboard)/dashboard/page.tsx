"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { getProfile, getWorkflowRuns, getAuditLog } from "@/lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";
import type { AuditEntry } from "@/lib/api-client";
import type { ElementType } from "react";

export default function DashboardPage() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 30_000,
  });

  const { data: runData } = useQuery({
    queryKey: ["workflows", undefined, 1],
    queryFn: () => getWorkflowRuns({ perPage: 8 }),
    staleTime: 15_000,
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-log", 1],
    queryFn: () => getAuditLog(1),
    staleTime: 30_000,
  });

  const runs = runData?.items ?? [];
  const recentAudit = auditData?.items.slice(0, 5) ?? [];

  const inProgressCount = runs.filter((r) => r.status === "in_progress").length;

  const stats = profile?.stats;
  const successRate =
    stats?.workflowSuccessRate != null
      ? `${Math.round(stats.workflowSuccessRate)}%`
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your GitHub Actions activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Repositories"
          value={stats?.repositoryCount ?? 0}
          icon={GitBranch}
        />
        <StatCard
          label="Total Runs"
          value={stats?.totalRuns ?? 0}
          icon={Activity}
        />
        <StatCard
          label="Successful"
          value={stats?.successCount ?? 0}
          icon={CheckCircle}
          accent="green"
          {...(successRate ? { sub: `${successRate} success rate` } : {})}
        />
        <StatCard
          label="Failed"
          value={stats?.failureCount ?? 0}
          icon={XCircle}
          accent="red"
        />
      </div>

      {inProgressCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 animate-spin shrink-0" />
          {inProgressCount} workflow{inProgressCount !== 1 ? "s" : ""} in
          progress
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent workflow runs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Workflow Runs
            </h2>
            <Link
              href="/workflows"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {runs.length > 0 ? (
            <div className="space-y-1.5">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <Activity className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No workflow runs yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trigger a workflow to see activity here.
              </p>
            </div>
          )}
        </div>

        {/* Recent audit activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <Link
              href="/audit-log"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentAudit.length > 0 ? (
            <div className="space-y-1.5">
              {recentAudit.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <TrendingUp className="mx-auto h-7 w-7 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No activity yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Actions like installs, syncs, and secret changes appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: number;
  icon: ElementType;
  accent?: "green" | "red";
  sub?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 flex flex-col gap-2 ${
        accent === "green"
          ? "border-primary/30"
          : accent === "red"
            ? "border-destructive/25"
            : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <Icon
          className={`h-4 w-4 ${
            accent === "green"
              ? "text-primary"
              : accent === "red"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground -mt-1">{sub}</p>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "repository.synced_first": "Repo synced",
  "repository.synced_with_changes": "Repo updated",
  "repository.privatized": "Repo privatized",
  "repository.publicized": "Repo made public",
  "secret.upserted": "Secret set",
  "secret.deleted": "Secret deleted",
  "workflow_run.rerun": "Workflow rerun",
  "workflow_run.cancelled": "Workflow cancelled",
  "installation.created": "App installed",
  "installation.deleted": "App uninstalled",
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const time = new Date(entry.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent/20 transition-colors">
      <div className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {entry.resourceType}
          {entry.resourceId ? ` · ${entry.resourceId}` : ""}
        </p>
      </div>
      <p className="text-xs text-muted-foreground shrink-0">{time}</p>
    </div>
  );
}

function RunRow({ run }: { run: WorkflowRun }) {
  const isRunning = run.status === "in_progress";
  const isSuccess = run.conclusion === "success";
  const isFailed =
    run.conclusion === "failure" || run.conclusion === "timed_out";

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent/20 transition-colors">
      {isRunning ? (
        <Clock className="h-4 w-4 shrink-0 text-amber-500 animate-spin" />
      ) : isSuccess ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
      ) : isFailed ? (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{run.workflowName}</p>
        <p className="text-xs text-muted-foreground">{run.branch}</p>
      </div>
      <a
        href={run.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
      >
        GitHub
      </a>
    </div>
  );
}
