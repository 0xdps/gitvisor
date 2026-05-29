"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  getRepositories,
  getSecrets,
  getSecretGroups,
  createSecretGroup,
  updateSecretGroup,
  deleteSecretGroup,
  rotateSecretGroup,
  updateSecret,
  deleteSecret,
} from "@/lib/api-client";
import type { SecretGroup, SecretMeta, Repository } from "@gitvisor/shared";
import { useAccount } from "@/lib/account-context";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Tab = "groups" | "inventory" | "repo";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "groups",    label: "Groups",    icon: Layers },
  { id: "inventory", label: "Inventory", icon: KeyRound },
  { id: "repo",      label: "Per Repo",  icon: RefreshCw },
];

// Groups Tab
function GroupsTab({ repos }: { repos: Repository[] }) {
  const queryClient = useQueryClient();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["secret-groups"],
    queryFn: getSecretGroups,
    staleTime: 30_000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [rotatingGroup, setRotatingGroup] = useState<SecretGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState<SecretGroup | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => deleteSecretGroup(groupId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["secret-groups"] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Groups let you rotate a secret across multiple repos at once.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg border border-blue/30 bg-blue/[0.07] px-3 py-1.5 text-xs font-medium text-blue hover:bg-blue/[0.12] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New group
        </button>
      </div>

      {groups.length === 0 && !showCreate && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No groups yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
            Create a group to manage shared secrets across multiple repositories.
          </p>
        </div>
      )}

      {showCreate && (
        <GroupForm
          repos={repos}
          onCancel={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void queryClient.invalidateQueries({ queryKey: ["secret-groups"] });
          }}
        />
      )}

      {editingGroup && (
        <GroupForm
          repos={repos}
          initial={editingGroup}
          onCancel={() => setEditingGroup(null)}
          onSaved={() => {
            setEditingGroup(null);
            void queryClient.invalidateQueries({ queryKey: ["secret-groups"] });
          }}
        />
      )}

      <div className="space-y-3">
        {groups.map((group) =>
          editingGroup?.id === group.id ? null : (
            <GroupCard
              key={group.id}
              group={group}
              repos={repos}
              onRotate={() => setRotatingGroup(group)}
              onEdit={() => setEditingGroup(group)}
              onDelete={() => {
                if (confirm(`Delete group "${group.name}"? This does not delete secrets from GitHub.`)) {
                  deleteMutation.mutate(group.id);
                }
              }}
              deleting={deleteMutation.isPending && deleteMutation.variables === group.id}
            />
          ),
        )}
      </div>

      {rotatingGroup && (
        <RotatePanel
          group={rotatingGroup}
          repos={repos}
          onClose={() => setRotatingGroup(null)}
        />
      )}
    </div>
  );
}

function GroupCard({
  group, repos, onRotate, onEdit, onDelete, deleting,
}: {
  group: SecretGroup;
  repos: Repository[];
  onRotate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const repoNames = group.repoIds
    .map((id) => repos.find((r) => r.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{group.name}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {group.repoIds.length} repo{group.repoIds.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {group.secretNames.length} secret{group.secretNames.length !== 1 ? "s" : ""}
            </span>
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Edit group">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors" title="Delete group">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {group.secretNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {group.secretNames.map((name) => (
            <span key={name} className="rounded border border-blue/20 bg-blue/[0.06] px-2 py-0.5 font-mono text-[10px] text-blue/80">
              {name}
            </span>
          ))}
        </div>
      )}

      {repoNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repoNames.map((name) => (
            <span key={name} className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground/60">Last rotated: {timeAgo(group.lastRotatedAt)}</span>
        <button
          onClick={onRotate}
          disabled={group.secretNames.length === 0 || group.repoIds.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Rotate
        </button>
      </div>
    </div>
  );
}

function GroupForm({
  repos, initial, onCancel, onSaved,
}: {
  repos: Repository[];
  initial?: SecretGroup;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [secretInput, setSecretInput] = useState("");
  const [secretNames, setSecretNames] = useState<string[]>(initial?.secretNames ?? []);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set(initial?.repoIds ?? []));
  const [secretError, setSecretError] = useState("");

  const createMutation = useMutation({ mutationFn: createSecretGroup });
  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateSecretGroup>[1]) => updateSecretGroup(initial!.id, patch),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  function addSecret() {
    const val = secretInput.trim().toUpperCase();
    if (!val) return;
    if (!/^[A-Z][A-Z0-9_]*$/.test(val)) { setSecretError("Must start with a letter, uppercase only."); return; }
    if (secretNames.includes(val)) { setSecretError("Already in the list."); return; }
    setSecretError("");
    setSecretNames((prev) => [...prev, val]);
    setSecretInput("");
  }

  function toggleRepo(id: string) {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) return;
    const base = {
      name: name.trim(),
      secretNames,
      repoIds: Array.from(selectedRepoIds),
    };
    const desc = description.trim();
    if (initial) {
      await updateMutation.mutateAsync({
        ...base,
        description: desc || null,
      });
    } else {
      await createMutation.mutateAsync({
        ...base,
        ...(desc ? { description: desc } : {}),
      });
    }
    onSaved();
  }

  return (
    <div className="rounded-xl border border-blue/20 bg-blue/[0.04] p-5 space-y-4">
      <h3 className="text-sm font-semibold">{initial ? "Edit group" : "New secret group"}</h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Group name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deploy tokens"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are these secrets for?"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Secret names</label>
        <div className="flex gap-2">
          <input value={secretInput}
            onChange={(e) => { setSecretInput(e.target.value.toUpperCase()); setSecretError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addSecret()}
            placeholder="DEPLOY_TOKEN"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button type="button" onClick={addSecret} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors">Add</button>
        </div>
        {secretError && <p className="text-xs text-destructive">{secretError}</p>}
        {secretNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {secretNames.map((n) => (
              <span key={n} className="flex items-center gap-1 rounded border border-blue/20 bg-blue/[0.06] px-2 py-0.5 font-mono text-[10px] text-blue/80">
                {n}
                <button onClick={() => setSecretNames((p) => p.filter((x) => x !== n))} className="text-blue/50 hover:text-destructive transition-colors">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Repositories ({selectedRepoIds.size} selected)</label>
        <div className="max-h-44 overflow-y-auto rounded-md border border-input bg-background divide-y divide-border">
          {repos.map((repo) => (
            <label key={repo.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors">
              <input type="checkbox" checked={selectedRepoIds.has(repo.id)} onChange={() => toggleRepo(repo.id)}
                className="h-3.5 w-3.5 rounded border-input accent-blue" />
              <span className="text-xs font-mono truncate">{repo.fullName}</span>
            </label>
          ))}
          {repos.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No repositories yet.</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={submit} disabled={!name.trim() || isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-blue/90 transition-colors">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {initial ? "Save" : "Create"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

function RotatePanel({ group, repos, onClose }: { group: SecretGroup; repos: Repository[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(group.secretNames.map((n) => [n, ""])));
  const [results, setResults] = useState<{ repoId: string; ok: boolean; error?: string }[] | null>(null);
  const [rotating, setRotating] = useState(false);

  const allFilled = group.secretNames.every((n) => values[n]?.trim());
  const groupRepos = repos.filter((r) => group.repoIds.includes(r.id));

  async function doRotate() {
    setRotating(true);
    setResults(null);
    try {
      const res = await rotateSecretGroup(group.id, values);
      setResults(res.results);
      void queryClient.invalidateQueries({ queryKey: ["secret-groups"] });
      void queryClient.invalidateQueries({ queryKey: ["secrets"] });
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-background border-l border-border overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Rotate: {group.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{groupRepos.length} repo{groupRepos.length !== 1 ? "s" : ""} will be updated</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New values</p>
            {group.secretNames.map((name) => (
              <div key={name} className="space-y-1">
                <label className="text-xs font-mono text-blue/80">{name}</label>
                <input type="password" value={values[name] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [name]: e.target.value }))}
                  placeholder="New value"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target repositories</p>
            <div className="space-y-1">
              {groupRepos.map((repo) => {
                const result = results?.find((r) => r.repoId === repo.id);
                return (
                  <div key={repo.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                    <span className="flex-1 text-xs font-mono truncate">{repo.fullName}</span>
                    {result ? (
                      result.ok ? <Check className="h-3.5 w-3.5 text-success shrink-0" /> : (
                        <span title={result.error}><AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" /></span>
                      )
                    ) : rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50 shrink-0" /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {results && (
            <div className={`rounded-md border px-3 py-2 text-xs ${results.every((r) => r.ok) ? "border-success/30 bg-success/[0.07] text-success" : "border-warning/30 bg-warning/[0.07] text-warning"}`}>
              {results.every((r) => r.ok)
                ? `All ${results.length} repos updated successfully.`
                : `${results.filter((r) => r.ok).length}/${results.length} repos updated.`}
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <button onClick={doRotate} disabled={!allFilled || rotating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-blue/90 transition-colors">
            {rotating ? <><Loader2 className="h-4 w-4 animate-spin" /> Rotating...</> : <><RotateCcw className="h-4 w-4" /> Rotate in all repos</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inventory Tab
function InventoryTab({ repos, allSecrets }: { repos: Repository[]; allSecrets: SecretMeta[] }) {
  const scopedRepoIds = useMemo(() => new Set(repos.map((r) => r.id)), [repos]);
  const scopedSecrets = useMemo(() => allSecrets.filter((s) => scopedRepoIds.has(s.repositoryId)), [allSecrets, scopedRepoIds]);
  const secretNames = useMemo(() => Array.from(new Set(scopedSecrets.map((s) => s.name))).sort(), [scopedSecrets]);
  const reposWithSecrets = useMemo(() => repos.filter((r) => scopedSecrets.some((s) => s.repositoryId === r.id)), [repos, scopedSecrets]);
  const secretSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of scopedSecrets) set.add(`${s.repositoryId}:${s.name}`);
    return set;
  }, [scopedSecrets]);

  if (secretNames.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">No secrets tracked</p>
        <p className="mt-1 text-xs text-muted-foreground">Sync repositories with secrets to see the matrix.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="sticky left-0 bg-card px-4 py-2.5 text-left font-medium text-muted-foreground min-w-40">Repository</th>
            {secretNames.map((name) => (
              <th key={name} className="px-3 py-2.5 font-mono font-medium text-muted-foreground whitespace-nowrap text-center">{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reposWithSecrets.map((repo, i) => (
            <tr key={repo.id} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
              <td className="sticky left-0 bg-background px-4 py-2 font-mono truncate max-w-[160px]">
                <Link href={`/secrets?tab=repo&repositoryId=${repo.id}`} className="hover:text-blue transition-colors truncate block">{repo.name}</Link>
              </td>
              {secretNames.map((name) => (
                <td key={name} className="px-3 py-2 text-center">
                  {secretSet.has(`${repo.id}:${name}`) ? (
                    <Check className="mx-auto h-3.5 w-3.5 text-success" />
                  ) : (
                    <span className="mx-auto block h-3.5 w-3.5 rounded-full border border-border/50" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Per Repo Tab
function PerRepoTab({ repos, allSecrets }: { repos: Repository[]; allSecrets: SecretMeta[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;

  const { data: secrets, isLoading, error } = useQuery({
    queryKey: ["secrets", repositoryId],
    queryFn: () => getSecrets(repositoryId),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });

  const secretCountByRepo = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSecrets) map.set(s.repositoryId, (map.get(s.repositoryId) ?? 0) + 1);
    return map;
  }, [allSecrets]);

  const reposWithSecrets = allSecrets.length > 0 ? repos.filter((r) => secretCountByRepo.has(r.id)) : repos;
  const selectedRepo = repos.find((r) => r.id === repositoryId);

  if (!repositoryId) {
    return (
      <div className="space-y-2">
        {reposWithSecrets.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No secrets found</p>
          </div>
        )}
        {reposWithSecrets.map((repo) => (
          <button key={repo.id} onClick={() => router.push(`/secrets?tab=repo&repositoryId=${repo.id}`)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-accent/10 transition-colors group text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {!repo.private && <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="text-sm font-semibold truncate">{repo.fullName}</span>
                {secretCountByRepo.get(repo.id) != null && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium shrink-0 text-muted-foreground">
                    {secretCountByRepo.get(repo.id)} secret{(secretCountByRepo.get(repo.id) ?? 0) !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.push("/secrets?tab=repo")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> All repositories
      </button>
      <div>
        <p className="text-sm font-semibold">{selectedRepo?.fullName ?? repositoryId}</p>
        <p className="text-xs text-muted-foreground mt-0.5">GitHub Actions secrets</p>
      </div>
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Failed to load secrets.</div>}
      {secrets?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No secrets</p>
        </div>
      )}
      {secrets && secrets.length > 0 && selectedRepo && (
        <div className="space-y-1.5">
          {secrets.map((secret) => (
            <SecretRow key={secret.name} secret={secret} repoId={Number(selectedRepo.githubRepoId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SecretRow({ secret, repoId }: { secret: SecretMeta; repoId: number }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const update = useMutation({
    mutationFn: () => updateSecret(repoId, secret.name, value),
    onSuccess: () => { setEditing(false); setValue(""); void queryClient.invalidateQueries({ queryKey: ["secrets"] }); },
  });

  const remove = useMutation({
    mutationFn: () => deleteSecret(repoId, secret.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-mono font-medium">{secret.name}</p>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${secret.scope === "environment" ? "border-purple-900/50 bg-purple-950/20 text-purple-400" : secret.scope === "org" ? "border-amber-900/50 bg-amber-950/20 text-amber-400" : "border-blue/30 bg-blue/5 text-blue"}`}>
              {secret.scope}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {secret.githubUpdatedAt ? `Updated ${new Date(secret.githubUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : null}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(!editing)} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Update value">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <input type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="New secret value"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={() => update.mutate()} disabled={!value || update.isPending} className="rounded p-1.5 text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => { setEditing(false); setValue(""); }} className="rounded p-1.5 text-muted-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Main page
function SecretsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as Tab) ?? "groups";
  const { selected: selectedAccount } = useAccount();

  const { data: repos = [] } = useQuery({ queryKey: ["repositories"], queryFn: getRepositories, staleTime: 30_000 });
  const { data: allSecrets = [] } = useQuery({ queryKey: ["secrets", undefined], queryFn: () => getSecrets(), staleTime: 30_000 });

  const scopedRepos = useMemo(
    () => selectedAccount ? repos.filter((r) => r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/")) : repos,
    [repos, selectedAccount],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Secrets</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage GitHub Actions secrets across your repositories.</p>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => router.push(`/secrets?tab=${id}`)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === id ? "bg-blue/15 text-blue" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "groups" && <GroupsTab repos={scopedRepos} />}
      {activeTab === "inventory" && <InventoryTab repos={scopedRepos} allSecrets={allSecrets} />}
      {activeTab === "repo" && <PerRepoTab repos={scopedRepos} allSecrets={allSecrets} />}
    </div>
  );
}

export default function SecretsPage() {
  return (
    <Suspense fallback={<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-14 rounded-lg border border-border bg-muted/40 animate-pulse" />))}</div>}>
      <SecretsContent />
    </Suspense>
  );
}
