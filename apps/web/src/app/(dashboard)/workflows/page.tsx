"use client";

import { Suspense, useTransition, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Ban,
  Search,
  ChevronDown,
} from "lucide-react";
import { getWorkflowRuns, getRepositories, rerunWorkflow, cancelWorkflow } from "@/lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

type StatusFilter = "all" | "in_progress" | "success" | "failure" | "cancelled";

const FILTERS: { label: string; value: StatusFilter; dot?: string }[] = [
  { label: "All",       value: "all" },
  { label: "Running",   value: "in_progress", dot: "bg-warning" },
  { label: "Success",   value: "success",     dot: "bg-success" },
  { label: "Failed",    value: "failure",     dot: "bg-destructive" },
  { label: "Cancelled", value: "cancelled",   dot: "bg-muted-foreground/50" },
];

function buildUrl(params: {
  status?: StatusFilter;
  repositoryId?: string;
  workflowName?: string;
  page?: number;
}): string {
  const p = new URLSearchParams();
  if (params.status && params.status !== "all") p.set("status", params.status);
  if (params.repositoryId) p.set("repositoryId", params.repositoryId);
  if (params.workflowName) p.set("workflowName", params.workflowName);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const qs = p.toString();
  return `/workflows${qs ? `?${qs}` : ""}`;
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowsContent />
    </Suspense>
  );
}

function WorkflowsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const rawStatus = (searchParams.get("status") ?? "all") as StatusFilter;
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const workflowNameParam = searchParams.get("workflowName") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [workflowNameInput, setWorkflowNameInput] = useState(workflowNameParam);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setWorkflowNameInput(workflowNameParam); }, [workflowNameParam]);

  function navigate(overrides: {
    status?: StatusFilter;
    repositoryId?: string | undefined;
    workflowName?: string;
    page?: number;
  }) {
    const repoId = "repositoryId" in overrides ? overrides.repositoryId : repositoryId;
    const wfName = "workflowName" in overrides ? overrides.workflowName : workflowNameParam;
    const url = buildUrl({
      status: overrides.status ?? rawStatus,
      ...(repoId !== undefined ? { repositoryId: repoId } : {}),
      ...(wfName ? { workflowName: wfName } : {}),
      page: overrides.page ?? 1,
    });
    startTransition(() => { router.replace(url, { scroll: false }); });
  }

  function onWorkflowNameChange(value: string) {
    setWorkflowNameInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { navigate({ workflowName: value }); }, 350);
  }

  const needsClientFilter = rawStatus === "success" || rawStatus === "failure" || rawStatus === "cancelled";
  const apiStatus = rawStatus === "in_progress" ? "in_progress" : needsClientFilter ? "completed" : undefined;

  const { data: runData, isLoading } = useQuery({
    queryKey: ["workflows", apiStatus, repositoryId, workflowNameParam, page],
    queryFn: () => getWorkflowRuns({
      ...(apiStatus !== undefined ? { status: apiStatus } : {}),
      ...(repositoryId ? { repositoryId } : {}),
      ...(workflowNameParam ? { workflowName: workflowNameParam } : {}),
      page,
      perPage: 20,
    }),
    staleTime: 15_000,
  });

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 60_000,
  });

  const repoMap = new Map(repos?.map((r) => [r.id, r.fullName]) ?? []);

  const items = runData?.items ?? [];
  const filtered = needsClientFilter
    ? items.filter((r) => {
        if (rawStatus === "success") return r.conclusion === "success";
        if (rawStatus === "failure") return r.conclusion === "failure" || r.conclusion === "timed_out";
        if (rawStatus === "cancelled") return r.conclusion === "cancelled";
        return true;
      })
    : items;

  const total = needsClientFilter ? filtered.length : (runData?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workflows</h1>
          {runData && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString()} run{total !== 1 ? "s" : ""}
              {rawStatus !== "all" ? ` · ${FILTERS.find((f) => f.value === rawStatus)?.label}` : ""}
              {repositoryId ? ` · ${repoMap.get(repositoryId) ?? repositoryId}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const isActive = rawStatus === f.value;
            return (
              <button
                key={f.value}
                onClick={() => navigate({ status: f.value })}
                disabled={isPending}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border disabled:opacity-60 ${
                  isActive
                    ? "bg-blue/10 text-blue border-blue/30"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                }`}
              >
                {f.dot && <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Repo dropdown */}
        {repos && repos.length > 0 && (
          <div className="relative ml-auto">
            <select
              value={repositoryId ?? ""}
              onChange={(e) => navigate({ repositoryId: e.target.value || undefined })}
              disabled={isPending}
              className="appearance-none rounded-lg border border-border bg-card text-xs text-muted-foreground pl-3 pr-7 py-1.5 hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-60 cursor-pointer focus:outline-none"
            >
              <option value="">All repos</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {/* Workflow name search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by workflow…"
            value={workflowNameInput}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
            className="rounded-lg border border-border bg-card text-xs pl-7 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue/50 transition-colors w-44"
          />
        </div>
      </div>

      {/* ── Run list ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 text-center px-6">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No runs found</p>
          <p className="mt-1 text-xs text-muted-foreground/50">Try a different filter.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
          {filtered.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              repoName={repoMap.get(run.repositoryId) ?? null}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {!needsClientFilter && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate({ page: page - 1 })}
              disabled={page <= 1 || isPending}
              aria-label="Previous page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate({ page: page + 1 })}
              disabled={page >= totalPages || isPending}
              aria-label="Next page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RunRow ─────────────────────────────────────────────────────────────────────

function RunRow({ run, repoName }: { run: WorkflowRun; repoName: string | null }) {
  const queryClient = useQueryClient();

  const rerun = useMutation({
    mutationFn: () => rerunWorkflow(run.githubRunId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const cancel = useMutation({
    mutationFn: () => cancelWorkflow(run.githubRunId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const isRunning = run.status === "in_progress";
  const isQueued  = run.status === "queued";
  const isSuccess = run.conclusion === "success";
  const isFailed  = run.conclusion === "failure" || run.conclusion === "timed_out";
  const isCancelled = run.conclusion === "cancelled";

  const statusIcon = isRunning ? (
    <RefreshCw className="h-3.5 w-3.5 text-warning animate-spin" />
  ) : isQueued ? (
    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
  ) : isSuccess ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
  ) : isFailed ? (
    <XCircle className="h-3.5 w-3.5 text-destructive" />
  ) : (
    <Ban className="h-3.5 w-3.5 text-muted-foreground/40" />
  );

  const statusLabel = isRunning ? "Running"
    : isQueued ? "Queued"
    : isSuccess ? "Success"
    : isFailed ? (run.conclusion === "timed_out" ? "Timed out" : "Failed")
    : isCancelled ? "Cancelled"
    : (run.conclusion ?? "—");

  const statusClass = isRunning ? "text-warning bg-warning/10 border-warning/20"
    : isSuccess ? "text-success bg-success/10 border-success/20"
    : isFailed ? "text-destructive bg-destructive/10 border-destructive/20"
    : "text-muted-foreground bg-muted/30 border-border";

  const repoShort = repoName ? (repoName.split("/")[1] ?? repoName) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors group">

      {/* Status icon */}
      <div className="shrink-0">{statusIcon}</div>

      {/* Status label */}
      <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold w-18 justify-center ${statusClass}`}>
        {statusLabel}
      </span>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium truncate">{run.workflowName}</p>
          {repoShort && (
            <span className="shrink-0 text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded font-mono">
              {repoShort}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-muted-foreground/50">#{run.runNumber}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
          <span className="truncate">{run.branch}</span>
          {run.commitSha && (
            <>
              <span className="opacity-40 shrink-0">·</span>
              <span className="font-mono shrink-0">{run.commitSha.slice(0, 7)}</span>
            </>
          )}
          {run.triggeredBy && (
            <>
              <span className="opacity-40 shrink-0">·</span>
              <span className="shrink-0">{run.triggeredBy}</span>
            </>
          )}
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
        {run.durationMs != null && (
          <span className="tabular-nums w-14 text-right">{formatDuration(run.durationMs)}</span>
        )}
        <span className="tabular-nums w-14 text-right">{run.startedAt ? timeAgo(run.startedAt) : "—"}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {run.status === "completed" && (
            <button
              onClick={() => rerun.mutate()}
              disabled={rerun.isPending}
              title="Re-run workflow"
              className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              title="Cancel run"
              className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Ban className="h-3 w-3" />
            </button>
          )}
          <a
            href={run.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in GitHub"
            className="flex h-6 w-6 items-center justify-center rounded border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
