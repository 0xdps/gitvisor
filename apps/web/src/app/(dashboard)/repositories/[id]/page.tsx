"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckmarkFilled, ErrorFilled, InProgress, Launch } from "@carbon/icons-react";
import {
  Button,
  InlineLoading,
  InlineNotification,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from "@carbon/react";
import { getPackages, getPullRequests, getReleases, getRepositories, getSecrets, getWorkflowRuns } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { ageInDays, timeAgo } from "@/lib/format";
import type { WorkflowRun } from "@gitvisor/shared";

type Tone = "error" | "success" | "warning" | "neutral";

export default function RepositoryOperationsPage() {
  const { id } = useParams<{ id: string }>();
  const reposQuery = useQuery({ queryKey: ["repositories"], queryFn: getRepositories });
  const repos = reposQuery.data ?? [];
  const repo = repos.find((item) => item.id === id);
  const runsQuery = useQuery({
    queryKey: ["workflows", id],
    queryFn: () => getWorkflowRuns({ repositoryId: id, perPage: 20 }),
    enabled: Boolean(repo),
  });
  const prsQuery = useQuery({
    queryKey: ["pull-requests"],
    queryFn: () => getPullRequests(100),
    enabled: Boolean(repo),
  });
  const releasesQuery = useQuery({
    queryKey: ["releases", id],
    queryFn: () => getReleases({ repositoryId: id, perPage: 10 }),
    enabled: Boolean(repo),
  });
  const secretsQuery = useQuery({
    queryKey: ["secrets", id],
    queryFn: () => getSecrets(id),
    enabled: Boolean(repo),
  });
  const packagesQuery = useQuery({
    queryKey: ["packages", id],
    queryFn: () => getPackages(id),
    enabled: Boolean(repo),
  });

  if (reposQuery.isLoading) {
    return (
      <div>
        <PageHeader kicker="Repository" title="Loading operations" />
        <div style={{ marginTop: "1.5rem" }}>
          <InlineLoading description="Loading repository" />
        </div>
      </div>
    );
  }

  if (reposQuery.isError) {
    return (
      <div>
        <PageHeader kicker="Repository" title="Repository unavailable" />
        <InlineNotification
          kind="error"
          title="Repositories not loaded"
          subtitle="Try refreshing this page."
          hideCloseButton
          lowContrast
          style={{ marginTop: "1.5rem" }}
        />
      </div>
    );
  }

  if (!repo) {
    return (
      <div>
        <PageHeader
          kicker="Repository"
          title="Repository not found"
          detail="It may still be syncing, or it belongs to another account."
        />
        <InlineNotification
          kind="warning"
          title="Repository not found"
          subtitle="It may still be syncing, or it belongs to another account."
          hideCloseButton
          lowContrast
          style={{ marginTop: "1.5rem" }}
        />
      </div>
    );
  }

  const prs = prsQuery.data ?? [];
  const secrets = secretsQuery.data ?? [];
  const packages = packagesQuery.data ?? [];
  const workflowItems = runsQuery.data?.items ?? [];
  const releaseItems = releasesQuery.data?.items ?? [];
  const repoPrs = prs.filter((pr) => pr.repoId === repo.id || pr.repoFullName === repo.fullName);
  const defaultRuns = workflowItems.filter((run) => run.branch === repo.defaultBranch);
  const latestDefault = defaultRuns[0];
  const failing = latestDefault?.status === "completed" && (latestDefault.conclusion === "failure" || latestDefault.conclusion === "timed_out");
  const staleSecrets = secrets.filter((secret) => ageInDays(secret.githubUpdatedAt ?? secret.updatedAt) > 180).length;
  const signalError = runsQuery.isError || prsQuery.isError || secretsQuery.isError;
  const verdictPending = runsQuery.isLoading || prsQuery.isLoading || secretsQuery.isLoading;
  const verdict = repo.locked
    ? "Locked by the current plan"
    : signalError
      ? "Some signals failed to load"
      : failing
        ? `${latestDefault?.workflowName ?? "CI"} is blocking ${repo.defaultBranch}`
        : `${repo.defaultBranch} is clear · ${repoPrs.length} open PRs · ${staleSecrets} secrets due for rotation`;

  const defaultBranchValue = runsQuery.isError
    ? "Unavailable"
    : failing
      ? "Failing"
      : latestDefault
        ? "Passing"
        : "No runs";
  const defaultBranchTone: Tone = runsQuery.isError
    ? "neutral"
    : failing
      ? "error"
      : latestDefault
        ? "success"
        : "neutral";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        kicker={repo.fullName}
        title={verdictPending ? "Loading operations" : verdict}
        detail={`Last push ${timeAgo(repo.pushedAt)} · synced ${timeAgo(repo.syncedAt)}`}
      />

      {signalError && !repo.locked ? (
        <InlineNotification
          kind="error"
          title="Some repository signals failed to load"
          subtitle="Workflow, pull request, or secret data could not be loaded. Try refreshing this page."
          hideCloseButton
          lowContrast
        />
      ) : null}

      <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Signal
          label="Default branch"
          value={defaultBranchValue}
          href={`/workflows?repositoryId=${repo.id}`}
          loading={runsQuery.isLoading}
          tone={defaultBranchTone}
        />
        <Signal
          label="Open pull requests"
          value={prsQuery.isError ? "Unavailable" : String(repoPrs.length)}
          href="/pull-requests"
          loading={prsQuery.isLoading}
          tone="neutral"
        />
        <Signal
          label="Latest release"
          value={releasesQuery.isError ? "Unavailable" : (releaseItems[0]?.tagName ?? "None")}
          href={`/releases?repositoryId=${repo.id}`}
          loading={releasesQuery.isLoading}
          tone="neutral"
        />
        <Signal
          label="Secrets overdue"
          value={secretsQuery.isError ? "Unavailable" : String(staleSecrets)}
          href={`/secrets?tab=repo&repositoryId=${repo.id}`}
          loading={secretsQuery.isLoading}
          tone={!secretsQuery.isError && staleSecrets > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <Panel title="Recent workflows" href={`/workflows?repositoryId=${repo.id}`}>
          <QueryState
            isLoading={runsQuery.isLoading}
            isError={runsQuery.isError}
            isEmpty={workflowItems.length === 0}
            loadingDescription="Loading workflows"
            errorTitle="Workflows not loaded"
            emptyTitle="No workflow runs"
            emptySubtitle="Runs for this repository will appear here."
          >
            <div style={{ overflowX: "auto" }}>
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableHeader>Workflow</TableHeader>
                    <TableHeader>Branch</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workflowItems.slice(0, 6).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <a
                          href={run.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                        >
                          {run.workflowName}
                          <Launch size={14} />
                        </a>
                      </TableCell>
                      <TableCell>{run.branch}</TableCell>
                      <TableCell>
                        <RunStatus run={run} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </QueryState>
        </Panel>

        <Panel title="Open pull requests" href="/pull-requests">
          <QueryState
            isLoading={prsQuery.isLoading}
            isError={prsQuery.isError}
            isEmpty={repoPrs.length === 0}
            loadingDescription="Loading pull requests"
            errorTitle="Pull requests not loaded"
            emptyTitle="No open pull requests"
            emptySubtitle="Open pull requests for this repository will appear here."
          >
            <StructuredListWrapper isCondensed>
              <StructuredListBody>
                {repoPrs.slice(0, 6).map((pr) => (
                  <StructuredListRow key={pr.id}>
                    <StructuredListCell>
                      <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                        {pr.title}
                      </a>
                      <span className="cds--helper-text" style={{ display: "block" }}>
                        #{pr.number} · idle {timeAgo(pr.updatedAt)}
                      </span>
                    </StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
          </QueryState>
        </Panel>

        <Panel title="Releases" href={`/releases?repositoryId=${repo.id}`}>
          <QueryState
            isLoading={releasesQuery.isLoading}
            isError={releasesQuery.isError}
            isEmpty={releaseItems.length === 0}
            loadingDescription="Loading releases"
            errorTitle="Releases not loaded"
            emptyTitle="No releases"
            emptySubtitle="Published releases for this repository will appear here."
          >
            <StructuredListWrapper isCondensed>
              <StructuredListBody>
                {releaseItems.slice(0, 6).map((release) => (
                  <StructuredListRow key={release.id}>
                    <StructuredListCell>
                      <a href={release.htmlUrl} target="_blank" rel="noopener noreferrer">
                        {release.tagName}
                      </a>
                    </StructuredListCell>
                    <StructuredListCell noWrap>{timeAgo(release.publishedAt)}</StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
          </QueryState>
        </Panel>

        <Panel title="Packages and secrets" href={`/packages?repositoryId=${repo.id}`}>
          <QueryState
            isLoading={packagesQuery.isLoading}
            isError={packagesQuery.isError}
            isEmpty={packages.length === 0}
            loadingDescription="Loading packages"
            errorTitle="Packages not loaded"
            emptyTitle="No packages"
            emptySubtitle="Packages published from this repository will appear here."
          >
            <div style={{ overflowX: "auto" }}>
              <Table size="sm">
                <TableHead>
                  <TableRow>
                    <TableHeader>Package</TableHeader>
                    <TableHeader>Version</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {packages.slice(0, 4).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.latestVersion ?? item.ecosystem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </QueryState>
          <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--cds-border-subtle)" }}>
            {secretsQuery.isLoading ? (
              <InlineLoading description="Loading secrets" />
            ) : secretsQuery.isError ? (
              <InlineNotification
                kind="error"
                title="Secrets not loaded"
                subtitle="Try refreshing this page."
                hideCloseButton
                lowContrast
              />
            ) : (
              <Link href={`/secrets?tab=repo&repositoryId=${repo.id}`} className="cds--link">
                {secrets.length} secret names · {staleSecrets} older than 180 days
              </Link>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Signal({
  label,
  value,
  href,
  loading,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  loading: boolean;
  tone: Tone;
}) {
  const color =
    tone === "error"
      ? "var(--cds-support-error)"
      : tone === "success"
        ? "var(--cds-support-success)"
        : tone === "warning"
          ? "var(--cds-support-warning)"
          : undefined;

  return (
    <Link href={href} className="block h-full" style={{ color: "inherit", textDecoration: "none" }}>
      <Tile style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
        <span className="cds--label-01">{label}</span>
        {loading ? (
          <InlineLoading description="Loading" />
        ) : (
          <span
            className="cds--type-productive-heading-03"
            style={{ overflow: "hidden", textOverflow: "ellipsis", color }}
          >
            {value}
          </span>
        )}
      </Tile>
    </Link>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <Tile style={{ height: "100%", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--cds-border-subtle)",
        }}
      >
        <h2 className="cds--type-productive-heading-01">{title}</h2>
        <Button as={Link} href={href} kind="ghost" size="sm" renderIcon={ArrowRight}>
          Open
        </Button>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </Tile>
  );
}

function QueryState({
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
  if (isLoading) {
    return (
      <div style={{ padding: "1rem" }}>
        <InlineLoading description={loadingDescription} />
      </div>
    );
  }
  if (isError) {
    return (
      <div style={{ padding: "1rem" }}>
        <InlineNotification kind="error" title={errorTitle} subtitle="Try refreshing this page." hideCloseButton lowContrast />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div style={{ padding: "1rem" }}>
        <InlineNotification kind="info" title={emptyTitle} subtitle={emptySubtitle} hideCloseButton lowContrast />
      </div>
    );
  }
  return children;
}

function RunStatus({ run }: { run: WorkflowRun }) {
  const label = run.conclusion ?? run.status;
  if (run.conclusion === "failure" || run.conclusion === "timed_out") {
    return (
      <Tag size="sm" type="red" renderIcon={ErrorFilled}>
        {label}
      </Tag>
    );
  }
  if (run.status !== "completed") {
    return (
      <Tag size="sm" type="blue" renderIcon={InProgress}>
        {label}
      </Tag>
    );
  }
  if (run.conclusion === "success") {
    return (
      <Tag size="sm" type="green" renderIcon={CheckmarkFilled}>
        {label}
      </Tag>
    );
  }
  return <Tag size="sm" type="gray">{label}</Tag>;
}
