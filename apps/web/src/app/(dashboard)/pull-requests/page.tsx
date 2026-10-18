"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPullRequests, getWorkflowRuns } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { timeAgo } from "@/lib/format";

type Filter = "needs-action" | "review" | "drafts" | "all";

export default function PullRequestsPage() {
  const [filter, setFilter] = useState<Filter>("needs-action");
  const { data: prs = [], isLoading } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(100),
    staleTime: 120_000,
  });
  const { data: runs } = useQuery({
    queryKey: ["workflows", "pr-context"],
    queryFn: () => getWorkflowRuns({ perPage: 100 }),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    return prs.map((pr) => {
      const run = (runs?.items ?? []).find((item) => item.branch === pr.headRef);
      const idleHours = (Date.now() - new Date(pr.updatedAt).getTime()) / 3_600_000;
      return { pr, run, stale: !pr.draft && idleHours > 48 };
    }).sort((a, b) => new Date(a.pr.updatedAt).getTime() - new Date(b.pr.updatedAt).getTime());
  }, [prs, runs]);

  const visible = rows.filter((row) => {
    if (filter === "review") return row.pr.requestedReviewersCount > 0;
    if (filter === "drafts") return row.pr.draft;
    if (filter === "needs-action") return !row.pr.draft && (row.stale || row.pr.requestedReviewersCount > 0 || row.run?.conclusion === "failure");
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Flow"
        title="Pull requests"
        detail="Waiting reviews and branch CI across repositories. Review itself stays on GitHub."
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["needs-action", "Needs action"],
            ["review", "Review requested"],
            ["drafts", "Drafts"],
            ["all", "All open"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-md border px-3 py-1.5 text-xs ${filter === id ? "border-blue/40 bg-blue/10 text-blue" : "border-border text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? <p className="px-4 py-8 text-sm text-muted-foreground">Loading pull requests…</p> : visible.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No pull requests in this queue.</p> : (
          <div className="divide-y divide-border/70">
            {visible.map(({ pr, run, stale }) => (
              <a key={`${pr.repoFullName}#${pr.number}`} href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="grid gap-2 px-4 py-3 hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_180px_110px]">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{pr.title}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{pr.repoFullName} #{pr.number} · {pr.headRef} → {pr.baseRef}</span>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {run ? `${run.workflowName}: ${run.status === "completed" ? run.conclusion : run.status}` : "No matching run in the latest 100"}
                </span>
                <span className={`font-mono text-[11px] ${stale ? "text-warning" : "text-muted-foreground"}`}>{pr.draft ? "draft" : `idle ${timeAgo(pr.updatedAt)}`}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
