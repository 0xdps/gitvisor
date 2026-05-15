"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, ArrowLeft, ChevronRight, Globe, Pencil, Trash2, Check, X } from "lucide-react";
import {
  getRepositories,
  getSecrets,
  updateSecret,
  deleteSecret,
} from "@/lib/api-client";
import type { SecretMeta } from "@gitvisor/shared";
import { useState } from "react";

function SecretsContent() {
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 30_000,
  });

  const selectedRepo = repos?.find((r) => r.id === repositoryId);

  // Load ALL secrets (no repositoryId) so we can filter the repo list to only those with secrets
  const { data: allSecrets } = useQuery({
    queryKey: ["secrets", undefined],
    queryFn: () => getSecrets(),
    staleTime: 30_000,
  });

  const { data: secrets, isLoading, error } = useQuery({
    queryKey: ["secrets", repositoryId],
    queryFn: () => getSecrets(repositoryId),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });

  // Build a map of repositoryId → secret count from the all-secrets response
  const secretCountByRepo = new Map<string, number>();
  if (allSecrets) {
    for (const s of allSecrets) {
      secretCountByRepo.set(s.repositoryId, (secretCountByRepo.get(s.repositoryId) ?? 0) + 1);
    }
  }

  // Only show repos that have at least one secret. Fall back to all repos while allSecrets is loading.
  const reposWithSecrets = allSecrets
    ? (repos?.filter((r) => secretCountByRepo.has(r.id)) ?? [])
    : (repos ?? []);

  if (!repositoryId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Secrets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a repository to manage its GitHub Actions secrets.
            {allSecrets && reposWithSecrets.length === 0 && repos && repos.length > 0
              ? " No repositories have secrets configured yet."
              : ""}
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
            <p className="mt-1 text-sm text-muted-foreground">Connect a repository first.</p>
          </div>
        )}

        {reposWithSecrets.length > 0 && (
          <div className="space-y-2">
            {reposWithSecrets.map((repo) => (
              <Link
                key={repo.id}
                href={`/secrets?repositoryId=${repo.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-accent/20 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {repo.private ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold truncate">{repo.fullName}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                        repo.private
                          ? "border-orange-900/50 bg-orange-950/20 text-orange-400"
                          : "border-blue/30 bg-blue/5 text-blue"
                      }`}
                    >
                      {repo.private ? "Private" : "Public"}
                    </span>
                    {secretCountByRepo.get(repo.id) != null && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium shrink-0 text-muted-foreground">
                        {secretCountByRepo.get(repo.id)} secret{(secretCountByRepo.get(repo.id) ?? 0) !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate pl-5">
                      {repo.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
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
          href="/secrets"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All repositories
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Secrets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedRepo?.fullName ?? repositoryId}
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
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
          <p className="mt-3 font-medium">No secrets</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This repository has no GitHub Actions secrets.
          </p>
        </div>
      )}

      {secrets && secrets.length > 0 && selectedRepo && (
        <div className="space-y-1.5">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.name}
              secret={secret}
              repoId={Number(selectedRepo.githubRepoId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SecretRow({
  secret,
  repoId,
}: {
  secret: SecretMeta;
  repoId: number;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const update = useMutation({
    mutationFn: () => updateSecret(repoId, secret.name, value),
    onSuccess: () => {
      setEditing(false);
      setValue("");
      void queryClient.invalidateQueries({ queryKey: ["secrets"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSecret(repoId, secret.name),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-mono font-medium">{secret.name}</p>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                secret.scope === "environment"
                  ? "border-purple-900/50 bg-purple-950/20 text-purple-400"
                  : secret.scope === "org"
                    ? "border-amber-900/50 bg-amber-950/20 text-amber-400"
                    : "border-blue/30 bg-blue/5 text-blue"
              }`}
            >
              {secret.scope}
            </span>
            {secret.scope === "environment" && secret.environment && (
              <span className="text-xs text-muted-foreground">{secret.environment}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {secret.githubUpdatedAt
              ? `Updated on GitHub ${
                  new Date(secret.githubUpdatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                }`
              : secret.updatedAt
                ? `Updated ${new Date(secret.updatedAt).toLocaleDateString()}`
                : null}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(!editing)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Update value"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="New secret value"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => update.mutate()}
            disabled={!value || update.isPending}
            className="rounded p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue("");
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SecretsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      }
    >
      <SecretsContent />
    </Suspense>
  );
}
