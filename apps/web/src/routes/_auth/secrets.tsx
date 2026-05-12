import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, ArrowLeft } from "lucide-react";
import { getRepositories, getSecrets } from "../../lib/api-client";
import type { SecretMeta } from "@gitvisor/shared";

export const Route = createFileRoute("/_auth/secrets")({
  validateSearch: (raw: Record<string, unknown>) => ({
    repositoryId: typeof raw["repositoryId"] === "string" ? raw["repositoryId"] : undefined,
  }),
  component: SecretsPage,
});

function SecretsPage() {
  const { repositoryId } = Route.useSearch();

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const selectedRepo = repos?.find((r) => r.id === repositoryId);

  const {
    data: secrets,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["secrets", repositoryId],
    queryFn: () => getSecrets(repositoryId!),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });

  // Show repo picker if no repo selected
  if (!repositoryId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secrets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a repository to view its secrets.
          </p>
        </div>

        {!repos && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {repos?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">No repositories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Install the GitHub App to connect repositories first.
            </p>
          </div>
        )}

        {repos && repos.length > 0 && (
          <div className="space-y-2">
            {repos.map((repo) => (
              <Link
                key={repo.id}
                to="/secrets"
                search={{ repositoryId: repo.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
              >
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{repo.fullName}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/secrets"
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All repositories
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Secrets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedRepo?.fullName ?? repositoryId} — secret names only. Values are never stored.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load secrets.
        </div>
      )}

      {secrets && secrets.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No secrets found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Secrets will appear here after the initial sync completes.
          </p>
        </div>
      )}

      {secrets && secrets.length > 0 && (
        <div className="space-y-1.5">
          {secrets.map((secret) => (
            <SecretRow key={secret.id} secret={secret} />
          ))}
        </div>
      )}
    </div>
  );
}

function SecretRow({ secret }: { secret: SecretMeta }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-sm">{secret.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {secret.githubUpdatedAt
          ? `Updated ${new Date(secret.githubUpdatedAt).toLocaleDateString()}`
          : secret.updatedAt
            ? `Updated ${new Date(secret.updatedAt).toLocaleDateString()}`
            : ""}
      </span>
    </div>
  );
}
