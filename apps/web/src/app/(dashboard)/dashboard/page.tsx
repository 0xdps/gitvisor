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
} from "lucide-react";
import { getRepositories, getWorkflowRuns } from "@/lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";
import type { ElementType } from "react";

export default function DashboardPage() {
  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const { data: runData } = useQuery({
    queryKey: ["workflows", undefined, 1],
    queryFn: () => getWorkflowRuns({ perPage: 10 }),
    staleTime: 15_000,
  });

  const runs = runData?.items ?? [];
  const repoCount = repos?.length ?? 0;

  const successCount = runs.filter((r) => r.conclusion === "success").length;
  const failureCount = runs.filter(
    (r) => r.conclusion === "failure" || r.conclusion === "timed_out",
  ).length;
  const inProgressCount = runs.filter(
    (r) => r.status === "in_progress",
  ).length;

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
          value={repoCount}
          icon={GitBranch}
        />
        <StatCard
          label="Recent Runs"
          value={runs.length}
          icon={Activity}
        />
        <StatCard
          label="Successful"
          value={successCount}
          icon={CheckCircle}
          accent="green"
        />
        <StatCard
          label="Failed"
          value={failureCount}
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

      {runs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Workflow Runs</h2>
            <Link
              href="/workflows"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {runs.slice(0, 8).map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}

      {runs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No workflow runs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a repository and trigger a workflow to see data here.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ElementType;
  accent?: "green" | "red";
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
