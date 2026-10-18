"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
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
}

const CI_LABEL: Record<CiState, string> = {
  failing: "Failing",
  running: "Running",
  passing: "Passing",
  none: "No runs",
};

const CI_DOT: Record<CiState, string> = {
  failing: "bg-destructive",
  running: "bg-blue animate-pulse",
  passing: "bg-success",
  none: "bg-white/15",
};

export function RepoMatrix({ rows }: { rows: RepoRow[] }) {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [query, setQuery] = useState("");

  const attentionCount = rows.filter((r) => r.score > 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "attention" && attentionCount > 0 ? r.score > 0 : true))
      .filter((r) => (q ? r.fullName.toLowerCase().includes(q) : true));
  }, [rows, filter, query, attentionCount]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Repository state</h2>
          <p className="text-[11px] text-muted-foreground">
            Every signal per repo, sorted by what needs you first
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {(
              [
                ["attention", `Needs attention · ${attentionCount}`],
                ["all", `All · ${rows.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filter === id ? "bg-blue/15 text-blue" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter repos"
              className="h-8 w-40 rounded-lg border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-blue"
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          {rows.length === 0 ? "No repositories synced yet." : "Nothing matches."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-normal">Repository</th>
                <th className="px-3 py-2 font-normal">CI on default</th>
                <th className="px-3 py-2 font-normal">30d pass</th>
                <th className="px-3 py-2 font-normal">PRs</th>
                <th className="px-3 py-2 font-normal">Issues</th>
                <th className="px-3 py-2 font-normal">Latest release</th>
                <th className="px-3 py-2 font-normal">Secrets</th>
                <th className="px-3 py-2 font-normal">Pkgs</th>
                <th className="px-4 py-2 text-right font-normal">Pushed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors hover:bg-white/[0.02] ${r.locked ? "opacity-50" : ""} ${
                    r.ci === "failing" ? "bg-destructive/[0.04]" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <Link href={`/workflows?repositoryId=${r.id}`} className="flex items-center gap-1.5 hover:text-blue">
                      {r.locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      <span className="truncate font-mono text-foreground">{r.name}</span>
                      {r.private && !r.locked && (
                        <span className="rounded border border-border px-1 text-[9px] uppercase text-muted-foreground">
                          private
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${CI_DOT[r.ci]}`} />
                      <span className={r.ci === "failing" ? "text-destructive" : r.ci === "running" ? "text-blue" : "text-muted-foreground"}>
                        {CI_LABEL[r.ci]}
                      </span>
                      {r.lastRunAt && <span className="text-muted-foreground/60">{timeAgo(r.lastRunAt)}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.successRate == null ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span
                          className={`font-mono ${
                            r.successRate < 70 ? "text-destructive" : r.successRate < 90 ? "text-warning" : "text-foreground"
                          }`}
                        >
                          {r.successRate}%
                        </span>
                        <span className="text-muted-foreground/60">{r.runs30d}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    <span className={r.openPrs ? "text-foreground" : "text-muted-foreground/50"}>{r.openPrs}</span>
                    {r.stalePrs > 0 && <span className="text-warning"> · {r.stalePrs} stale</span>}
                  </td>
                  <td className={`px-3 py-2.5 font-mono ${r.openIssues ? "text-foreground" : "text-muted-foreground/50"}`}>
                    {r.openIssues}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.latestRelease ? (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-foreground">{r.latestRelease.tag}</span>
                        <span className="text-muted-foreground/60">{timeAgo(r.latestRelease.at)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    <span className={r.secrets ? "text-foreground" : "text-muted-foreground/50"}>{r.secrets}</span>
                    {r.staleSecrets > 0 && <span className="text-warning"> · {r.staleSecrets} old</span>}
                  </td>
                  <td className={`px-3 py-2.5 font-mono ${r.packages ? "text-foreground" : "text-muted-foreground/50"}`}>
                    {r.packages}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{timeAgo(r.pushedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
