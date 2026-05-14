"use client";

import { Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  RefreshCw,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  getWorkflowRuns,
  getRepositories,
  rerunWorkflow,
  cancelWorkflow,
} from "@/lib/api-client";
import type { WorkflowRun, WorkflowRunConclusion } from "@gitvisor/shared";

function WorkflowsContent() {
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflows", repositoryId, page],
    queryFn: () =>
      getWorkflowRuns({
        ...(repositoryId !== undefined ? { repositoryId } : {}),
        page,
        perPage: 30,
      }),
    staleTime: 15_000,
  });

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });
  const repoMap = new Map(repos?.map((r) => [r.id, r.fullName]) ?? []);

  const rerun = useMutation({
    mutationFn: (runId: number) => rerunWorkflow(runId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const cancel = useMutation({
    mutationFn: (runId: number) => cancelWorkflow(runId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workflow Runs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {repositoryId
            ? "Runs for this repository"
            : "All workflow runs across your repositories"}
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load workflow runs.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No workflow runs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs will appear here after your first push or workflow trigger.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-1.5">
          {data.items.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              repoName={repoMap.get(run.repositoryId) ?? null}
              onRerun={() => rerun.mutate(run.githubRunId)}
              onCancel={() => cancel.mutate(run.githubRunId)}
              isActing={rerun.isPending || cancel.isPending}
            />
          ))}
        </div>
      )}

      {data && (data.hasMore || page > 1) && (
        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">{data.total} total runs</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?${repositoryId ? `repositoryId=${repositoryId}&` : ""}page=${page - 1}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-accent transition-colors"
              >
                Previous
              </a>
            )}
            {data.hasMore && (
              <a
                href={`?${repositoryId ? `repositoryId=${repositoryId}&` : ""}page=${page + 1}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-accent transition-colors"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
  repoName,
  onRerun,
  onCancel,
  isActing,
}: {
  run: WorkflowRun;
  repoName: string | null;
  onRerun: () => void;
  onCancel: () => void;
  isActing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/20 transition-colors">
      <StatusIcon status={run.status} conclusion={run.conclusion} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {repoName && (
            <span className="text-xs font-medium text-blue/80 shrink-0">{repoName}</span>
          )}
          <span className="font-medium text-sm truncate">{run.workflowName}</span>
          <span className="text-xs text-muted-foreground shrink-0">#{run.runNumber}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {run.branch}
          {run.triggeredBy && (
            <span className="ml-1.5">· by {run.triggeredBy}</span>
          )}
          {run.commitSha && (
            <span className="ml-1.5 font-mono">· {run.commitSha.slice(0, 7)}</span>
          )}
          {run.durationMs && (
            <span className="ml-1.5">· {formatDuration(run.durationMs)}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">
          {run.startedAt ? timeAgo(run.startedAt) : ""}
        </span>
        <a
          href={run.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          GitHub
        </a>
        {run.status === "completed" && (
          <button
            onClick={onRerun}
            disabled={isActing}
            title="Re-run"
            className="ml-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        {run.status === "in_progress" && (
          <button
            onClick={onCancel}
            disabled={isActing}
            title="Cancel"
            className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  conclusion,
}: {
  status: string;
  conclusion: WorkflowRunConclusion;
}) {
  if (status === "in_progress")
    return <Clock className="h-4 w-4 shrink-0 text-amber-500 animate-spin" />;
  if (status === "queued")
    return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (conclusion === "success")
    return <CheckCircle className="h-4 w-4 shrink-0 text-primary" />;
  if (conclusion === "failure" || conclusion === "timed_out")
    return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
  if (conclusion === "cancelled")
    return <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WorkflowsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      }
    >
      <WorkflowsContent />
    </Suspense>
  );
}
