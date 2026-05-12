import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Activity, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { getRepositories, getWorkflowRuns } from "../../lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";
import type { ElementType } from "react";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
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
  const inProgressCount = runs.filter((r) => r.status === "in_progress").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your GitHub Actions activity.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Repositories"
          value={repoCount}
          icon={GitBranch}
          href="/repositories"
        />
        <StatCard
          label="Recent runs"
          value={runData?.total ?? 0}
          icon={Activity}
          href="/workflows"
        />
        <StatCard
          label="Successful"
          value={successCount}
          icon={CheckCircle}
          iconClass="text-emerald-500"
          href="/workflows"
        />
        <StatCard
          label="Failed"
          value={failureCount}
          icon={XCircle}
          iconClass="text-destructive"
          href="/workflows"
        />
      </div>

      {/* Recent runs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent workflow runs</h2>
          <Link
            to="/workflows"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {runs.length === 0 && !runData && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg border border-border bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {runs.length === 0 && runData && (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Activity className="mx-auto h-7 w-7 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">No workflow runs yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {repoCount === 0
                ? "Install the GitHub App and connect repositories to get started."
                : "Runs will appear here after your next push or workflow trigger."}
            </p>
            {repoCount === 0 && (
              <a
                href="https://github.com/apps/gitvisor/installations/new"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Install GitHub App
              </a>
            )}
          </div>
        )}

        {runs.length > 0 && (
          <div className="space-y-1.5">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}

        {inProgressCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-1" />
            {inProgressCount} run{inProgressCount > 1 ? "s" : ""} in progress
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  href,
}: {
  label: string;
  value: number;
  icon: ElementType;
  iconClass?: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="rounded-lg border border-border bg-card p-4 hover:bg-accent/20 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 text-muted-foreground ${iconClass ?? ""}`} />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Link>
  );
}

function RunRow({ run }: { run: WorkflowRun }) {
  let iconEl: React.ReactNode;
  if (run.status === "in_progress") {
    iconEl = <Clock className="h-3.5 w-3.5 text-amber-500" />;
  } else if (run.conclusion === "success") {
    iconEl = <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
  } else if (run.conclusion === "failure" || run.conclusion === "timed_out") {
    iconEl = <XCircle className="h-3.5 w-3.5 text-destructive" />;
  } else {
    iconEl = <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <a
      href={run.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:bg-accent/20 transition-colors"
    >
      {iconEl}
      <span className="flex-1 min-w-0 text-sm truncate">{run.workflowName}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{run.branch}</span>
      <span className="shrink-0 text-xs text-muted-foreground">#{run.runNumber}</span>
    </a>
  );
}

import React from "react";
