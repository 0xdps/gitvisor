import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, GitBranch, Lock, RefreshCw, User } from "lucide-react";
import { getInstallations, getRepositories } from "../../lib/api-client";
import type { AccountInstallation } from "../../lib/api-client";
import type { Repository } from "@gitvisor/shared";

export const Route = createFileRoute("/_auth/repositories")({
  component: RepositoriesPage,
});

function RepositoriesPage() {
  const { data: repos, isLoading, error } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Repositories connected via your GitHub App installation.
        </p>
      </div>

      {/* Always show the accounts panel so users can install on additional orgs */}
      <InstallAccountsPanel />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border border-border bg-muted/40 animate-pulse" />
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
            Install the GitHub App on one of your accounts above to start syncing repositories.
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
  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse" />
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
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
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
        <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Installed
        </span>
      ) : (
        <a
          href={account.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Install
        </a>
      )}
    </li>
  );
}

function RepoCard({ repo }: { repo: Repository }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{repo.fullName}</span>
            {repo.private && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Branch: {repo.defaultBranch}
            {repo.syncedAt && (
              <span className="ml-3">
                Synced {new Date(repo.syncedAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>

      <Link
        to="/workflows"
        search={{ repositoryId: repo.id }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        View runs
      </Link>
    </div>
  );
}
