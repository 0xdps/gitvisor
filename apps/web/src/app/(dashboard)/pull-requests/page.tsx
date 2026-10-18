"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPullRequests, getWorkflowRuns } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { timeAgo } from "@/lib/format";
import {
  ContentSwitcher,
  InlineLoading,
  InlineNotification,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Switch,
  Tag,
} from "@carbon/react";

type Filter = "needs-action" | "review" | "drafts" | "all";

export default function PullRequestsPage() {
  const [filter, setFilter] = useState<Filter>("needs-action");
  const { data: prs = [], isLoading, isError } = useQuery({
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
      const run = (runs?.items ?? []).find(
        (item) => item.repositoryId === pr.repoId && item.branch === pr.headRef,
      );
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
    <div>
      <PageHeader
        kicker="Flow"
        title="Pull requests"
        detail="Waiting reviews and branch CI across repositories. Review itself stays on GitHub."
      />
      <div style={{ marginTop: "1.5rem", maxWidth: "42rem" }}>
        <ContentSwitcher
          size="sm"
          selectedIndex={["needs-action", "review", "drafts", "all"].indexOf(filter)}
          onChange={({ index }) => {
            const next = (["needs-action", "review", "drafts", "all"] as const)[index ?? 0];
            if (next) setFilter(next);
          }}
        >
          <Switch name="needs-action" text="Needs action" />
          <Switch name="review" text="Review requested" />
          <Switch name="drafts" text="Drafts" />
          <Switch name="all" text="All open" />
        </ContentSwitcher>
      </div>
      <div style={{ marginTop: "1rem" }}>
        {isError ? (
          <InlineNotification
            kind="error"
            title="Pull requests not loaded"
            subtitle="Check your connection and try again."
            hideCloseButton
            lowContrast
          />
        ) : isLoading ? (
          <InlineLoading description="Loading pull requests" />
        ) : visible.length === 0 ? (
          <InlineNotification
            kind="info"
            title="This queue is clear"
            subtitle="No pull requests match the selected view."
            hideCloseButton
            lowContrast
          />
        ) : (
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
            {visible.map(({ pr, run, stale }) => (
                <StructuredListRow key={`${pr.repoFullName}#${pr.number}`}>
                  <StructuredListCell>
                    <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                      {pr.title}
                    </a>
                    <span className="cds--helper-text" style={{ display: "block" }}>
                      {pr.repoFullName} #{pr.number} · {pr.headRef} → {pr.baseRef}
                    </span>
                  </StructuredListCell>
                  <StructuredListCell>
                    {run ? (
                      <Tag
                        size="sm"
                        type={run.status !== "completed" ? "blue" : run.conclusion === "success" ? "green" : "red"}
                      >
                        {run.status === "completed" ? run.conclusion : run.status}
                      </Tag>
                    ) : (
                      <Tag size="sm" type="gray">No recent CI</Tag>
                    )}
                  </StructuredListCell>
                  <StructuredListCell noWrap>
                    <Tag size="sm" type={pr.draft ? "cool-gray" : stale ? "magenta" : "gray"}>
                      {pr.draft ? "draft" : `idle ${timeAgo(pr.updatedAt)}`}
                    </Tag>
                  </StructuredListCell>
                </StructuredListRow>
            ))}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
      </div>
    </div>
  );
}
