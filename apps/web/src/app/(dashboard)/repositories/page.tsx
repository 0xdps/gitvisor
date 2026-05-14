"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Archive,
  Building2,
  CheckCircle2,
  GitBranch,
  GitFork,
  GitPullRequest,
  Globe,
  KeyRound,
  Lock,
  Package,
  RefreshCw,
  Star,
  User,
} from "lucide-react";
import {
  getInstallations,
  getRepositories,
  syncRepositories,
} from "@/lib/api-client";
import type { AccountInstallation } from "@/lib/api-client";
import type { Repository } from "@gitvisor/shared";

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
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
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export default function RepositoriesPage() {
  const queryClient = useQueryClient();
  const {
    data: repos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const sync = useMutation({
    mutationFn: syncRepositories,
    onSuccess: ({ queued }) => {
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["repositories"] });
      }, 2000);
      console.log(`Queued ${queued} repo sync job(s)`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Repositories connected via your GitHub App installation.
          </p>
        </div>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`}
          />
          {sync.isPending
            ? "Syncing…"
            : sync.isSuccess
              ? `Synced (${sync.data.queued} queued)`
              : "Sync repositories"}
        </button>
      </div>

      <InstallAccountsPanel />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load repositories. Please try again.
        </div>
      )}

      {repos && repos.length === 0 && !isLoading && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No repositories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Install the GitHub App above, then click{" "}
            <strong>Sync repositories</strong> to import your repos.
          </p>
        </div>
      )}

      {repos && repos.length > 0 && (
        <div className="space-y-2">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstallAccountsPanel() {
  const {
    data: accounts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || !accounts) return null;

  const allInstalled = accounts.every((a) => a.installed);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="text-sm font-medium">GitHub App Installations</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Install the app on every account you want to sync repositories from.
          </p>
        </div>
        {allInstalled && (
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> All installed
          </span>
        )}
      </div>
      <ul className="divide-y divide-border">
        {accounts.map((account) => (
          <AccountRow key={account.githubId} account={account} />
        ))}
      </ul>
    </div>
  );
}

function AccountRow({ account }: { account: AccountInstallation }) {
  const Icon = account.type === "Organization" ? Building2 : User;
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {account.avatarUrl ? (
          <img
            src={account.avatarUrl}
            alt={account.login}
            className="h-7 w-7 rounded-full shrink-0"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{account.login}</p>
          <p className="text-xs text-muted-foreground">{account.type}</p>
        </div>
      </div>
      {account.installed ? (
        <span className="flex items-center gap-1 text-xs text-primary font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Installed
        </span>
      ) : (
        <a
          href={account.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Install
        </a>
      )}
    </li>
  );
}

function RepoCard({ repo }: { repo: Repository }) {
  const langColor = repo.language
    ? (LANG_COLORS[repo.language] ?? "#6b7280")
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:bg-accent/10 transition-colors">
      {/* Top row: visibility icon + name + badges + pushed time */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {repo.private ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <a
            href={`https://github.com/${repo.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-foreground hover:text-blue transition-colors truncate"
          >
            {repo.fullName}
          </a>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
              repo.private
                ? "border-orange-900/50 bg-orange-950/20 text-orange-400"
                : "border-blue/30 bg-blue/5 text-blue"
            }`}
          >
            {repo.private ? "Private" : "Public"}
          </span>
          {repo.archived && (
            <span className="inline-flex items-center gap-0.5 rounded border border-amber-900/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-500 shrink-0">
              <Archive className="h-2.5 w-2.5" />
              Archived
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {repo.pushedAt ? `pushed ${timeAgo(repo.pushedAt)}` : ""}
        </p>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-1 pl-5">
          {repo.description}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 pl-5 flex-wrap">
        {langColor && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: langColor }}
            />
            {repo.language}
          </span>
        )}
        {repo.stargazersCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3" />
            {repo.stargazersCount.toLocaleString()}
          </span>
        )}
        {repo.forksCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitFork className="h-3 w-3" />
            {repo.forksCount.toLocaleString()}
          </span>
        )}
        {repo.openPullsCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitPullRequest className="h-3 w-3" />
            {repo.openPullsCount} PR{repo.openPullsCount !== 1 ? "s" : ""}
          </span>
        )}
        {repo.openIssuesCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            {repo.openIssuesCount} issue{repo.openIssuesCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {repo.defaultBranch}
        </span>
      </div>

      {/* Quick action links */}
      <div className="mt-3 flex items-center gap-3 pl-5 border-t border-border/40 pt-3">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
          View
        </span>
        <Link
          href={`/workflows?repositoryId=${repo.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue transition-colors"
        >
          <Activity className="h-3 w-3" />
          Workflows
        </Link>
        <span className="text-border">·</span>
        <Link
          href={`/secrets?repositoryId=${repo.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue transition-colors"
        >
          <KeyRound className="h-3 w-3" />
          Secrets
        </Link>
        <span className="text-border">·</span>
        <Link
          href={`/packages?repositoryId=${repo.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue transition-colors"
        >
          <Package className="h-3 w-3" />
          Packages
        </Link>
      </div>
    </div>
  );
}
