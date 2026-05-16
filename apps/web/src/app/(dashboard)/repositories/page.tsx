"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  GitFork,
  Globe,
  Lock,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { getRepositories, syncRepositories } from "@/lib/api-client";
import type { Repository } from "@gitvisor/shared";
import { InstallAccountsPanel } from "@/components/install-accounts-panel";
import { useAccount } from "@/lib/account-context";

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Go: "#00ADD8",
  Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d", C: "#555555",
  "C#": "#178600", Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138",
  Kotlin: "#A97BFF", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c",
  Vue: "#41b883", Svelte: "#ff3e00",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

type SortKey = "name" | "pushed" | "stars" | "forks";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name",   label: "Name A–Z" },
  { value: "pushed", label: "Last pushed" },
  { value: "stars",  label: "Most stars" },
  { value: "forks",  label: "Most forks" },
];

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("pushed");
  const { selected: selectedAccount } = useAccount();

  const { data: repos, isLoading } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: syncRepositories,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });

  const filtered = useMemo(() => {
    if (!repos) return [];
    const accountPrefix = selectedAccount ? `${selectedAccount.login}/` : null;
    const q = search.toLowerCase();
    const list = repos.filter((r) => {
      if (accountPrefix && !r.fullName.toLowerCase().startsWith(accountPrefix.toLowerCase())) return false;
      if (q && !r.fullName.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "name")   return a.fullName.localeCompare(b.fullName);
      if (sort === "pushed") return (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
      if (sort === "stars")  return b.stargazersCount - a.stargazersCount;
      if (sort === "forks")  return b.forksCount - a.forksCount;
      return 0;
    });
  }, [repos, search, sort]);

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>
          {repos && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length}{filtered.length !== repos.length ? ` of ${repos.length}` : ""} {repos.length === 1 ? "repository" : "repositories"}
            </p>
          )}
        </div>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent hover:border-foreground/20 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Syncing…" : sync.isSuccess ? `Synced (${sync.data.queued} queued)` : "Sync"}
        </button>
      </div>

      {/* ── Search + sort bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 mr-0.5" />
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setSort(o.value)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                sort === o.value
                  ? "bg-blue/10 text-blue font-medium border border-blue/20"
                  : "hover:bg-accent/40 hover:text-foreground border border-transparent"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GitHub App install panel ─────────────────────────────── */}
      <InstallAccountsPanel />

      {/* ── Repo grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : repos && repos.length > 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Search className="mx-auto h-6 w-6 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No repositories match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 text-center px-6">
          <GitFork className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No repositories yet</p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            Install the GitHub App and sync to import your repositories.
          </p>
        </div>
      )}
    </div>
  );
}

// ── RepoCard ───────────────────────────────────────────────────────────────────

function RepoCard({ repo }: { repo: Repository }) {
  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? "#888888") : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-foreground/15 transition-colors">

      {/* Top row: name + privacy */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {repo.private ? (
              <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )}
            <p className="text-sm font-semibold truncate">{repo.name}</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{repo.owner}</p>
        </div>
        <Link
          href={`/workflows?repo=${repo.id}`}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 transition-colors"
          title="View workflows"
        >
          <Activity className="h-3 w-3" />
          Runs
        </Link>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Bottom row: language + stats */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto">
        {langColor && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: langColor }} />
            {repo.language}
          </span>
        )}
        {repo.stargazersCount > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {repo.stargazersCount.toLocaleString()}
          </span>
        )}
        {repo.forksCount > 0 && (
          <span className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            {repo.forksCount.toLocaleString()}
          </span>
        )}
        {repo.pushedAt && (
          <span className="ml-auto shrink-0">
            {timeAgo(repo.pushedAt)}
          </span>
        )}
      </div>

      {/* Archived badge */}
      {repo.archived && (
        <span className="self-start text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 border border-border rounded px-1.5 py-0.5">
          Archived
        </span>
      )}
    </div>
  );
}


