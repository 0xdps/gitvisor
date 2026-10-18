"use client";

import { Suspense, useTransition, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckmarkFilled,
  CloseFilled,
  Time,
  Locked,
  Renew,
  ChevronLeft,
  ChevronRight,
  Restart,
  Launch,
  StopFilled,
} from "@carbon/icons-react";
import {
  Button,
  ContentSwitcher,
  Dropdown,
  InlineLoading,
  InlineNotification,
  Search,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { getWorkflowRuns, getRepositories, rerunWorkflow, cancelWorkflow } from "@/lib/api-client";
import type { WorkflowRun } from "@gitvisor/shared";
import { useUpgradeModal } from "@/components/upgrade-modal";
import { PageHeader } from "@/components/page-header";
import { useAccount } from "@/lib/account-context";

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
    <Suspense fallback={<InlineLoading description="Loading workflow filters" />}>
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

  const { data: runData, isLoading, isError } = useQuery({
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

  const { selected: selectedAccount } = useAccount();
  const allRepos = repos ?? [];
  const scopedRepos = selectedAccount
    ? allRepos.filter((r) => r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"))
    : allRepos;

  const repoMap = new Map(scopedRepos.map((r) => [r.id, r.fullName]));
  const lockedRepoIds = new Set(scopedRepos.filter((r) => r.locked).map((r) => r.id));
  const unlockedRepos = scopedRepos.filter((r) => !r.locked);

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
    <div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <PageHeader
          kicker="Runs"
          title="Workflows"
          detail={
            runData ? (
              <>
                {total.toLocaleString()} run{total !== 1 ? "s" : ""}
                {rawStatus !== "all" ? ` · ${FILTERS.find((f) => f.value === rawStatus)?.label}` : ""}
                {repositoryId ? ` · ${repoMap.get(repositoryId) ?? repositoryId}` : ""}
              </>
            ) : null
          }
        />
      </div>

      {/* ── Filter row ──────────────────────────────────────────────────── */}
      <div className="gitvisor-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem", marginTop: "1.5rem", alignItems: "end" }}>
        {/* Status chips */}
        <ContentSwitcher
          size="sm"
          style={{ gridColumn: "1 / -1", maxWidth: "42rem" }}
          selectedIndex={FILTERS.findIndex((filter) => filter.value === rawStatus)}
          onChange={({ index }) => {
            const next = FILTERS[index ?? 0];
            if (next) navigate({ status: next.value });
          }}
        >
          {FILTERS.map((f) => {
            return (
              <Switch
                key={f.value}
                name={f.value}
                text={f.label}
                disabled={isPending}
              />
            );
          })}
        </ContentSwitcher>

        {/* Repo dropdown */}
        {repos && repos.length > 0 && (
            <Dropdown
              id="workflow-repository"
              label="All repositories"
              titleText="Repository"
              size="sm"
              items={[{ id: "", text: "All repositories" }, ...unlockedRepos.map((repo) => ({ id: repo.id, text: repo.fullName }))]}
              itemToString={(item) => item?.text ?? ""}
              selectedItem={
                repositoryId
                  ? { id: repositoryId, text: repoMap.get(repositoryId) ?? repositoryId }
                  : { id: "", text: "All repositories" }
              }
              onChange={({ selectedItem }) => navigate({ repositoryId: selectedItem?.id || undefined })}
              disabled={isPending}
            />
        )}

        {/* Workflow name search */}
        <Search
            labelText="Workflow name"
            placeholder="Filter by workflow name"
            size="sm"
            value={workflowNameInput}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
          />
      </div>

      {/* ── Run list ─────────────────────────────────────────────────────── */}
      {isError ? (
        <InlineNotification
          kind="error"
          title="Workflow runs not loaded"
          subtitle="Check your connection and try again."
          hideCloseButton
          lowContrast
          style={{ marginTop: "1.5rem" }}
        />
      ) : isLoading ? (
        <div style={{ marginTop: "1.5rem" }}><InlineLoading description="Loading workflow runs" /></div>
      ) : filtered.length === 0 ? (
        <InlineNotification
          kind="info"
          title="No runs found"
          subtitle="Try a different status, repository, or workflow name."
          hideCloseButton
          lowContrast
          style={{ marginTop: "1.5rem" }}
        />
      ) : (
        <div style={{ marginTop: "1.5rem" }}>
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader id="workflow-status" />
                <TableHeader id="workflow-name">Workflow</TableHeader>
                <TableHeader id="workflow-repo">Repository</TableHeader>
                <TableHeader id="workflow-duration">Duration</TableHeader>
                <TableHeader id="workflow-when">When</TableHeader>
                <TableHeader id="workflow-actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  repoName={repoMap.get(run.repositoryId) ?? null}
                  locked={lockedRepoIds.has(run.repositoryId)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {!needsClientFilter && totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => navigate({ page: page - 1 })}
              disabled={page <= 1 || isPending}
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={ChevronLeft}
              iconDescription="Previous page"
            />
            <Button
              onClick={() => navigate({ page: page + 1 })}
              disabled={page >= totalPages || isPending}
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={ChevronRight}
              iconDescription="Next page"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── RunRow ─────────────────────────────────────────────────────────────────────

function RunRow({ run, repoName, locked }: { run: WorkflowRun; repoName: string | null; locked?: boolean }) {
  const queryClient = useQueryClient();
  const { openUpgradeModal } = useUpgradeModal();
  const rerun = useMutation({
    mutationFn: () => rerunWorkflow(run.githubRunId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
  const cancel = useMutation({
    mutationFn: () => cancelWorkflow(run.githubRunId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const repoShort = repoName ? (repoName.split("/")[1] ?? repoName) : null;

  if (locked) {
    return (
      <TableRow>
        <TableCell>
          <Locked size={16} />
        </TableCell>
        <TableCell colSpan={4}>{repoShort ?? "Private repository"}</TableCell>
        <TableCell>
          <Button kind="ghost" size="sm" onClick={openUpgradeModal}>
            Unlock
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  const isRunning = run.status === "in_progress";
  const isQueued  = run.status === "queued";
  const isSuccess = run.conclusion === "success";
  const isFailed  = run.conclusion === "failure" || run.conclusion === "timed_out";
  const isCancelled = run.conclusion === "cancelled";

  const statusIcon = isRunning ? (
    <Renew size={16} className="animate-spin" />
  ) : isQueued ? (
    <Time size={16} />
  ) : isSuccess ? (
    <CheckmarkFilled size={16} style={{ color: "var(--cds-support-success)" }} />
  ) : isFailed ? (
    <CloseFilled size={16} style={{ color: "var(--cds-support-error)" }} />
  ) : (
    <StopFilled size={16} />
  );

  const statusLabel = isRunning ? "Running"
    : isQueued ? "Queued"
    : isSuccess ? "Passed"
    : isFailed ? (run.conclusion === "timed_out" ? "Timed out" : "Failed")
    : isCancelled ? "Cancelled"
    : (run.conclusion ?? "Finished");

  return (
    <TableRow>
      <TableCell>
        <span title={statusLabel} aria-label={statusLabel} style={{ display: "inline-flex" }}>
          {statusIcon}
        </span>
      </TableCell>
      <TableCell>
        <span className="cds--type-body-compact-01">{run.workflowName}</span>
        <span className="cds--helper-text" style={{ display: "block" }}>
          #{run.runNumber}
          {run.branch ? ` · ${run.branch}` : ""}
          {run.commitSha ? ` · ${run.commitSha.slice(0, 7)}` : ""}
          {run.triggeredBy ? ` · ${run.triggeredBy}` : ""}
        </span>
      </TableCell>
      <TableCell>{repoShort ?? "—"}</TableCell>
      <TableCell>{run.durationMs != null ? formatDuration(run.durationMs) : "—"}</TableCell>
      <TableCell>{run.startedAt ? timeAgo(run.startedAt) : "—"}</TableCell>
      <TableCell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
          {run.status === "completed" ? (
            <Button
              onClick={() => rerun.mutate()}
              disabled={rerun.isPending}
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Restart}
              iconDescription="Re-run workflow"
            />
          ) : null}
          {isRunning ? (
            <Button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              kind="danger--ghost"
              size="sm"
              hasIconOnly
              renderIcon={StopFilled}
              iconDescription="Cancel run"
            />
          ) : null}
          <Button
            as="a"
            href={run.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            kind="ghost"
            size="sm"
            renderIcon={Launch}
          >
            Logs
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
