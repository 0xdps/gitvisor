"use client";

import { useState } from "react";
import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Calendar,
  CheckmarkFilled,
  CircleDash,
  ErrorFilled,
  Fork,
  Globe,
  InProgress,
  Launch,
  Locked,
  LogoGithub,
} from "@carbon/icons-react";
import {
  Button,
  InlineLoading,
  InlineNotification,
  ProgressBar,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
  Tile,
} from "@carbon/react";
import { getProfile, getRepositories, getWorkflowRuns } from "@/lib/api-client";
import { me } from "@/lib/auth-client";
import type { Repository, WorkflowRunConclusion } from "@gitvisor/shared";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

function runTag(status: string, conclusion: WorkflowRunConclusion): {
  type: "blue" | "green" | "red" | "gray";
  icon: ElementType;
} {
  if (status === "in_progress") return { type: "blue", icon: InProgress };
  if (conclusion === "success") return { type: "green", icon: CheckmarkFilled };
  if (conclusion === "failure" || conclusion === "timed_out") return { type: "red", icon: ErrorFilled };
  return { type: "gray", icon: CircleDash };
}

export default function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 60_000,
  });

  const reposQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 60_000,
  });

  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
  });

  const workflowQuery = useQuery({
    queryKey: ["workflows", { page: 1, perPage: 6 }],
    queryFn: () => getWorkflowRuns({ page: 1, perPage: 6 }),
    staleTime: 30_000,
  });

  const profile = profileQuery.data;
  const repos = reposQuery.data;
  const user = userQuery.data;
  const workflowData = workflowQuery.data;

  if (profileQuery.isLoading) {
    return <InlineLoading description="Loading profile" />;
  }

  if (profileQuery.isError || !profile) {
    return (
      <InlineNotification
        kind="error"
        title="Profile not loaded"
        subtitle="Try refreshing this page."
        hideCloseButton
        lowContrast
      />
    );
  }

  const memberSince = user?.createdAt ? formatMemberSince(new Date(user.createdAt)) : null;
  const successRate = profile.stats.workflowSuccessRate;
  const workflowItems = workflowData?.items ?? [];

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60">
        <ProfileAvatar
          src={profile.avatarUrl}
          name={profile.name ?? profile.githubUsername}
        />

        <div style={{ marginTop: "1.25rem" }}>
          <h1 className="cds--type-productive-heading-04">{profile.name ?? profile.githubUsername}</h1>
          <p className="cds--helper-text">@{profile.githubUsername}</p>
        </div>

        <Button
          href={`https://github.com/${profile.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          kind="tertiary"
          size="sm"
          renderIcon={Launch}
          style={{ width: "100%", maxWidth: "100%", marginTop: "1.25rem" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <LogoGithub size={16} />
            View GitHub Profile
          </span>
        </Button>

        <div style={{ marginTop: "1.25rem" }}>
          {userQuery.isLoading ? (
            <InlineLoading description="Loading membership" />
          ) : userQuery.isError ? (
            <InlineNotification
              kind="error"
              title="Membership unavailable"
              subtitle="The member-since date could not be loaded."
              hideCloseButton
              lowContrast
            />
          ) : memberSince ? (
            <p className="cds--helper-text" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calendar size={16} />
              <span>Member since {memberSince}</span>
            </p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4">
          <StatCard label="Repositories" value={profile.stats.repositoryCount} icon={Fork} />
          <StatCard label="Total Runs" value={profile.stats.totalRuns} icon={Activity} />
          <StatCard label="Successful" value={profile.stats.successCount} icon={CheckmarkFilled} accent="green" />
          <StatCard label="Failed" value={profile.stats.failureCount} icon={ErrorFilled} accent="red" />
        </div>

        {successRate !== null ? (
          <Tile>
            <ProgressBar
              label="Workflow success rate"
              helperText={`${successRate}%`}
              value={successRate}
              max={100}
              size="small"
              status={successRate >= 100 ? "finished" : successRate < 50 ? "error" : "active"}
            />
          </Tile>
        ) : (
          <InlineNotification
            kind="info"
            title="No success rate yet"
            subtitle="Workflow success rate appears after completed runs."
            hideCloseButton
            lowContrast
          />
        )}

        <section>
          <SectionHeading title="Repositories" href="/repositories" />
          <SectionBody
            isLoading={reposQuery.isLoading}
            isError={reposQuery.isError}
            isEmpty={!repos || repos.length === 0}
            loadingDescription="Loading repositories"
            errorTitle="Repositories not loaded"
            emptyTitle="No repositories"
            emptySubtitle="Synced repositories will appear here."
          >
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
              {repos?.slice(0, 6).map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </SectionBody>
        </section>

        <section>
          <SectionHeading title="Recent Workflow Runs" href="/workflows" />
          <SectionBody
            isLoading={workflowQuery.isLoading}
            isError={workflowQuery.isError}
            isEmpty={workflowItems.length === 0}
            loadingDescription="Loading workflow runs"
            errorTitle="Workflow runs not loaded"
            emptyTitle="No workflow runs"
            emptySubtitle="Recent workflow runs will appear here."
          >
            <Tile style={{ height: "100%", padding: 0, overflow: "hidden" }}>
              <StructuredListWrapper isCondensed isFlush>
                <StructuredListBody>
                  {workflowItems.map((run) => {
                    const tag = runTag(run.status, run.conclusion);
                    const StatusIcon = tag.icon;
                    const statusColor =
                      tag.type === "green"
                        ? "var(--cds-support-success)"
                        : tag.type === "red"
                          ? "var(--cds-support-error)"
                          : tag.type === "blue"
                            ? "var(--cds-support-info)"
                            : "var(--cds-text-secondary)";
                    return (
                      <StructuredListRow key={run.id}>
                        <StructuredListCell noWrap>
                          <StatusIcon size={16} style={{ color: statusColor }} />
                        </StructuredListCell>
                        <StructuredListCell>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {run.workflowName}
                          </span>
                          <span className="cds--helper-text" style={{ display: "block" }}>
                            {run.branch}
                          </span>
                        </StructuredListCell>
                        <StructuredListCell>
                          <Tag size="sm" type={tag.type}>
                            {run.conclusion ?? run.status}
                          </Tag>
                          <span className="cds--helper-text" style={{ display: "block", marginTop: "0.25rem" }}>
                            {timeAgo(run.createdAt)}
                          </span>
                        </StructuredListCell>
                      </StructuredListRow>
                    );
                  })}
                </StructuredListBody>
              </StructuredListWrapper>
            </Tile>
          </SectionBody>
        </section>
      </div>
    </div>
  );
}

function ProfileAvatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      style={{
        width: "min(15rem, 100%)",
        aspectRatio: "1",
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cds-layer-02)",
        outline: "2px solid var(--cds-border-subtle)",
      }}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span className="cds--type-productive-heading-05">{getInitials(name)}</span>
      )}
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="cds--type-productive-heading-02">{title}</h2>
      <Button as={Link} href={href} kind="ghost" size="sm" renderIcon={ArrowRight}>
        View all
      </Button>
    </div>
  );
}

function SectionBody({
  isLoading,
  isError,
  isEmpty,
  loadingDescription,
  errorTitle,
  emptyTitle,
  emptySubtitle,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingDescription: string;
  errorTitle: string;
  emptyTitle: string;
  emptySubtitle: string;
  children: ReactNode;
}) {
  if (isLoading) return <InlineLoading description={loadingDescription} />;
  if (isError) {
    return (
      <InlineNotification
        kind="error"
        title={errorTitle}
        subtitle="Try refreshing this page."
        hideCloseButton
        lowContrast
      />
    );
  }
  if (isEmpty) {
    return (
      <InlineNotification
        kind="info"
        title={emptyTitle}
        subtitle={emptySubtitle}
        hideCloseButton
        lowContrast
      />
    );
  }
  return children;
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
  const color =
    accent === "green"
      ? "var(--cds-support-success)"
      : accent === "red"
        ? "var(--cds-support-error)"
        : "var(--cds-text-secondary)";

  return (
    <Tile style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <p className="cds--label-01">{label}</p>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="cds--type-productive-heading-04" style={{ color: accent ? color : undefined, fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString()}
      </p>
    </Tile>
  );
}

function RepoCard({ repo }: { repo: Repository }) {
  return (
    <Tile style={{ height: "100%", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <Link
          href={`/workflows?repositoryId=${repo.id}`}
          className="cds--link"
          style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {repo.name}
        </Link>
        {repo.private ? (
          <Tag size="sm" type="gray" renderIcon={Locked}>
            Private
          </Tag>
        ) : (
          <Tag size="sm" type="green" renderIcon={Globe}>
            Public
          </Tag>
        )}
      </div>
      <p className="cds--helper-text" style={{ marginTop: "auto" }}>
        {repo.owner}
      </p>
    </Tile>
  );
}
