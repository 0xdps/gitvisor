"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, ArrowLeft, Pencil, Trash2, Check, X } from "lucide-react";
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

  const { data: secrets, isLoading, error } = useQuery({
    queryKey: ["secrets", repositoryId],
    queryFn: () => getSecrets(repositoryId!),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });

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
              <div
                key={i}
                className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        )}

        {repos?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">No repositories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a repository first.
            </p>
          </div>
        )}

        {repos && repos.length > 0 && (
          <div className="space-y-1.5">
            {repos.map((repo) => (
              <Link
                key={repo.id}
                href={`/secrets?repositoryId=${repo.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/20 transition-colors"
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
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-mono font-medium">{secret.name}</p>
          {secret.updatedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {new Date(secret.updatedAt).toLocaleDateString()}
            </p>
          )}
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
