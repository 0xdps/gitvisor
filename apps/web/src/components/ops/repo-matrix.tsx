"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Locked } from "@carbon/icons-react";
import {
  ContentSwitcher,
  Search,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import { ListPagination, stableListStyle, stableSlots, usePagedSlice } from "@/components/ops/activity-feed";
import { timeAgo } from "@/lib/format";

export type CiState = "failing" | "running" | "passing" | "none";

export interface RepoRow {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  locked: boolean;
  ci: CiState;
  ciWorkflow: string | null;
  lastRunAt: string | null;
  successRate: number | null;
  runs30d: number;
  openPrs: number;
  stalePrs: number;
  openIssues: number;
  latestRelease: { tag: string; at: string | null } | null;
  secrets: number;
  staleSecrets: number;
  packages: number;
  pushedAt: string | null;
  score: number;
  reasons: string[];
}

const CI_LABEL: Record<CiState, string> = {
  failing: "Failing",
  running: "Running",
  passing: "Passing",
  none: "No runs",
};

const REPO_PAGE_SIZE = 6;

const CI_TAG: Record<CiState, "red" | "blue" | "green" | "gray"> = {
  failing: "red",
  running: "blue",
  passing: "green",
  none: "gray",
};

export function RepoMatrix({ rows }: { rows: RepoRow[] }) {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [query, setQuery] = useState("");

  const attentionCount = rows.filter((row) => row.score > 0).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => (filter === "attention" && attentionCount > 0 ? row.score > 0 : true))
      .filter((row) => (q ? row.fullName.toLowerCase().includes(q) : true));
  }, [rows, filter, query, attentionCount]);
  const { page, visible, setPage } = usePagedSlice(filtered, REPO_PAGE_SIZE);
  const slots = stableSlots(rows.length, REPO_PAGE_SIZE);

  return (
    <section className="gitvisor-stable-section">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 className="cds--type-productive-heading-02">Repository state</h2>
          <p className="cds--helper-text">Every signal per repo, sorted by what needs you first</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div className="gitvisor-switcher">
            <ContentSwitcher
              size="sm"
              selectedIndex={filter === "attention" ? 0 : 1}
              onChange={({ index }) => setFilter(index === 0 ? "attention" : "all")}
            >
              <Switch name="attention" text={`Needs attention ${attentionCount}`} />
              <Switch name="all" text={`All ${rows.length}`} />
            </ContentSwitcher>
          </div>
          <div style={{ inlineSize: "16rem" }}>
            <Search
              size="sm"
              labelText="Filter repositories"
              placeholder="Filter repos"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={slots === 0 ? "gitvisor-fixed-table gitvisor-fixed-table--empty" : "gitvisor-fixed-table"} style={stableListStyle(slots)}>
      <div className="gitvisor-fixed-table__body">
      {visible.length === 0 ? (
        <p className="cds--type-body-01">
          {rows.length === 0 ? "No repositories synced yet." : "Nothing matches."}
        </p>
      ) : (
        <Table size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>Repository</TableHeader>
              <TableHeader>CI on default</TableHeader>
              <TableHeader>30d pass</TableHeader>
              <TableHeader>PRs</TableHeader>
              <TableHeader>Issues</TableHeader>
              <TableHeader>Latest release</TableHeader>
              <TableHeader>Secrets</TableHeader>
              <TableHeader>Packages</TableHeader>
              <TableHeader>Pushed</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/repositories/${row.id}`} className="gitvisor-clip" title={row.fullName}>
                    <span className="gitvisor-repo-name">
                      {row.locked ? <Locked size={16} /> : null}
                      {row.name}
                      {row.private && !row.locked ? (
                        <Tag size="sm" type="gray">
                          private
                        </Tag>
                      ) : null}
                    </span>
                  </Link>
                  {row.reasons.length > 0 ? (
                    <span className="cds--helper-text gitvisor-clip" title={row.reasons.join(" · ")}>
                      {row.reasons.join(" · ")}
                    </span>
                  ) : (
                    <span className="cds--helper-text gitvisor-clip">&nbsp;</span>
                  )}
                </TableCell>
                <TableCell>
                  <Tag size="sm" type={CI_TAG[row.ci]}>
                    {CI_LABEL[row.ci]}
                  </Tag>
                  {row.lastRunAt ? <span className="cds--helper-text"> {timeAgo(row.lastRunAt)}</span> : null}
                </TableCell>
                <TableCell>
                  {row.successRate == null ? (
                    "—"
                  ) : (
                    <span>
                      {row.successRate}% <span className="cds--helper-text">{row.runs30d}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.openPrs}
                  {row.stalePrs > 0 ? <span style={{ color: "var(--cds-support-warning)" }}> · {row.stalePrs} stale</span> : null}
                </TableCell>
                <TableCell>{row.openIssues}</TableCell>
                <TableCell>
                  {row.latestRelease ? (
                    <span>
                      {row.latestRelease.tag} <span className="cds--helper-text">{timeAgo(row.latestRelease.at)}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {row.secrets}
                  {row.staleSecrets > 0 ? (
                    <span style={{ color: "var(--cds-support-warning)" }}> · {row.staleSecrets} old</span>
                  ) : null}
                </TableCell>
                <TableCell>{row.packages}</TableCell>
                <TableCell>{timeAgo(row.pushedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      </div>
      <ListPagination
        page={page}
        total={filtered.length}
        onChange={setPage}
        pageSize={REPO_PAGE_SIZE}
        pinned={rows.length > REPO_PAGE_SIZE}
      />
      </div>
    </section>
  );
}
