"use client";

import { Suspense, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Add,
  ArrowLeft,
  Checkmark,
  CheckmarkFilled,
  ChevronRight,
  CircleDash,
  Close,
  Edit,
  ErrorFilled,
  Globe,
  Layers,
  Password,
  Renew,
  TrashCan,
} from "@carbon/icons-react";
import {
  Button,
  Checkbox,
  ClickableTile,
  ComposedModal,
  DismissibleTag,
  Dropdown,
  InlineLoading,
  InlineNotification,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PasswordInput,
  Search,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Tag,
  TextInput,
  Tile,
} from "@carbon/react";
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
import { PageHeader } from "@/components/page-header";

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

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count !== 1 ? "s" : ""}`;
}

function scopeTagType(scope: SecretMeta["scope"]): "purple" | "warm-gray" | "blue" {
  if (scope === "environment") return "purple";
  if (scope === "org") return "warm-gray";
  return "blue";
}

type TabId = "groups" | "inventory" | "repo";
const TABS: { id: TabId; label: string; icon: ElementType }[] = [
  { id: "groups", label: "Groups", icon: Layers },
  { id: "inventory", label: "Inventory", icon: Password },
  { id: "repo", label: "Per Repo", icon: Renew },
];

type RepoChoice = { id: string; text: string };

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="gitvisor-secrets-equal-grid">{children}</div>;
}

const cardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.75rem",
  height: "100%",
  minWidth: 0,
  boxSizing: "border-box" as const,
};

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
  const [query, setQuery] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => deleteSecretGroup(groupId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["secret-groups"] }),
  });

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = normalizedQuery
    ? groups.filter((group) => {
        const repoNames = group.repoIds.map((id: string) => repos.find((repo) => repo.id === id)?.fullName ?? "");
        return (
          group.name.toLowerCase().includes(normalizedQuery) ||
          (group.description ?? "").toLowerCase().includes(normalizedQuery) ||
          group.secretNames.some((name: string) => name.toLowerCase().includes(normalizedQuery)) ||
          repoNames.some((name: string) => name.toLowerCase().includes(normalizedQuery))
        );
      })
    : groups;

  if (isLoading) {
    return <InlineLoading description="Loading groups" status="active" />;
  }

  return (
    <div>
      <div
        className="gitvisor-filter-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(16rem, 1fr) auto",
          gap: "1rem",
          alignItems: "end",
        }}
      >
        <Search
          id="secret-group-search"
          labelText="Find a group"
          placeholder="Filter by group, secret, or repository"
          value={query}
          size="sm"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="button" kind="primary" size="sm" renderIcon={Add} onClick={() => setShowCreate(true)}>
          New group
        </Button>
      </div>

      <p className="cds--type-body-01" style={{ marginTop: "1rem" }}>
        Groups let you rotate a secret across multiple repos at once.
      </p>

      {groups.length === 0 && !showCreate && (
        <InlineNotification
          kind="info"
          title="No groups yet"
          subtitle="Create a group to manage shared secrets across multiple repositories."
          hideCloseButton
          lowContrast
          style={{ marginTop: "1rem" }}
        />
      )}

      {groups.length > 0 && visibleGroups.length === 0 && (
        <InlineNotification
          kind="info"
          title="No matching groups"
          subtitle={`Nothing matches “${query.trim()}”.`}
          hideCloseButton
          lowContrast
          style={{ marginTop: "1rem" }}
        />
      )}

      {showCreate && (
        <div style={{ marginTop: "1rem" }}>
          <GroupForm
            repos={repos}
            onCancel={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false);
              void queryClient.invalidateQueries({ queryKey: ["secret-groups"] });
            }}
          />
        </div>
      )}

      {editingGroup && (
        <div style={{ marginTop: "1rem" }}>
          <GroupForm
            key={editingGroup.id}
            repos={repos}
            initial={editingGroup}
            onCancel={() => setEditingGroup(null)}
            onSaved={() => {
              setEditingGroup(null);
              void queryClient.invalidateQueries({ queryKey: ["secret-groups"] });
            }}
          />
        </div>
      )}

      {visibleGroups.some((group) => group.id !== editingGroup?.id) && (
        <div style={{ marginTop: "1rem" }}>
          <CardGrid>
            {visibleGroups.filter((group) => group.id !== editingGroup?.id).map((group) => (
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
            ))}
          </CardGrid>
        </div>
      )}

      {rotatingGroup && (
        <RotatePanel
          key={rotatingGroup.id}
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
    .map((id: string) => repos.find((repo) => repo.id === id)?.name)
    .filter((name: string | undefined): name is string => Boolean(name));

  return (
    <Tile style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="cds--type-productive-heading-01">{group.name}</span>
            <Tag size="sm" type="gray">{countLabel(group.repoIds.length, "repo")}</Tag>
            <Tag size="sm" type="gray">{countLabel(group.secretNames.length, "secret")}</Tag>
          </div>
          {group.description && (
            <p className="cds--type-helper-text-01" style={{ marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Button
            type="button"
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Edit}
            iconDescription="Edit group"
            tooltipPosition="bottom"
            onClick={onEdit}
          />
          {deleting ? (
            <InlineLoading description="Deleting" status="active" />
          ) : (
            <Button
              type="button"
              kind="danger--ghost"
              size="sm"
              hasIconOnly
              renderIcon={TrashCan}
              iconDescription="Delete group"
              tooltipPosition="bottom"
              onClick={onDelete}
            />
          )}
        </div>
      </div>

      {group.secretNames.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {group.secretNames.map((name: string) => (
            <Tag key={name} size="sm" type="blue" className="cds--type-code-01">{name}</Tag>
          ))}
        </div>
      )}

      {repoNames.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {repoNames.map((name: string) => (
            <Tag key={name} size="sm" type="outline">{name}</Tag>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginTop: "auto" }}>
        <span className="cds--type-helper-text-01">Last rotated: {timeAgo(group.lastRotatedAt)}</span>
        <Button
          type="button"
          kind="tertiary"
          size="sm"
          renderIcon={Renew}
          disabled={group.secretNames.length === 0 || group.repoIds.length === 0}
          onClick={onRotate}
        >
          Rotate
        </Button>
      </div>
    </Tile>
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
  const formId = initial?.id ?? "new";
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [secretInput, setSecretInput] = useState("");
  const [secretNames, setSecretNames] = useState<string[]>(initial?.secretNames ?? []);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set(initial?.repoIds ?? []));
  const [secretError, setSecretError] = useState("");
  const [repoQuery, setRepoQuery] = useState("");

  const createMutation = useMutation({ mutationFn: createSecretGroup });
  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateSecretGroup>[1]) => updateSecretGroup(initial!.id, patch),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const normalizedRepoQuery = repoQuery.trim().toLowerCase();
  const visibleRepos = normalizedRepoQuery
    ? repos.filter((repo) => repo.fullName.toLowerCase().includes(normalizedRepoQuery) || repo.name.toLowerCase().includes(normalizedRepoQuery))
    : repos;

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
    <Tile>
      <Layer>
        <h3 className="cds--type-productive-heading-02">{initial ? "Edit group" : "New secret group"}</h3>
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <TextInput
            id={`${formId}-name`}
            labelText="Group name"
            value={name}
            placeholder="e.g. Deploy tokens"
            onChange={(event) => setName(event.target.value)}
          />
          <TextInput
            id={`${formId}-description`}
            labelText="Description (optional)"
            value={description}
            placeholder="What are these secrets for?"
            onChange={(event) => setDescription(event.target.value)}
          />
          <div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
                <TextInput
                  id={`${formId}-secret-name`}
                  labelText="Secret names"
                  value={secretInput}
                  placeholder="DEPLOY_TOKEN"
                  invalid={Boolean(secretError)}
                  invalidText={secretError}
                  onChange={(event) => { setSecretInput(event.target.value.toUpperCase()); setSecretError(""); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSecret();
                    }
                  }}
                />
              </div>
              <Button type="button" kind="tertiary" onClick={addSecret} style={{ marginTop: "1.5rem" }}>
                Add
              </Button>
            </div>
            {secretNames.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.5rem" }}>
                {secretNames.map((secretName) => (
                  <DismissibleTag
                    key={secretName}
                    type="blue"
                    size="sm"
                    text={secretName}
                    dismissTooltipLabel={`Remove ${secretName}`}
                    onClose={() => setSecretNames((prev) => prev.filter((item) => item !== secretName))}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <Search
              id={`${formId}-repo-search`}
              size="sm"
              labelText={`Repositories (${selectedRepoIds.size} selected)`}
              placeholder="Filter repositories"
              value={repoQuery}
              onChange={(event) => setRepoQuery(event.target.value)}
            />
            <div style={{ maxHeight: "11rem", overflowY: "auto", marginTop: "0.5rem" }}>
              {visibleRepos.map((repo) => (
                <Checkbox
                  key={repo.id}
                  id={`${formId}-repo-${repo.id}`}
                  labelText={<span className="cds--type-code-01">{repo.fullName}</span>}
                  checked={selectedRepoIds.has(repo.id)}
                  onChange={() => toggleRepo(repo.id)}
                />
              ))}
              {repos.length === 0 && <p className="cds--type-helper-text-01">No repositories yet.</p>}
              {repos.length > 0 && visibleRepos.length === 0 && (
                <p className="cds--type-helper-text-01">No matching repositories.</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            {isPending ? (
              <InlineLoading description={initial ? "Saving group" : "Creating group"} status="active" />
            ) : (
              <Button type="button" kind="primary" renderIcon={Checkmark} disabled={!name.trim()} onClick={() => void submit()}>
                {initial ? "Save" : "Create"}
              </Button>
            )}
            <Button type="button" kind="secondary" disabled={isPending} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </Layer>
    </Tile>
  );
}

function RotatePanel({ group, repos, onClose }: { group: SecretGroup; repos: Repository[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(group.secretNames.map((name: string) => [name, ""])));
  const [results, setResults] = useState<{ repoId: string; ok: boolean; error?: string }[] | null>(null);
  const [rotating, setRotating] = useState(false);

  const allFilled = group.secretNames.every((name: string) => values[name]?.trim());
  const groupRepos = repos.filter((repo) => group.repoIds.includes(repo.id));
  const succeeded = results?.filter((result) => result.ok).length ?? 0;

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
    <ComposedModal open size="sm" onClose={onClose} selectorPrimaryFocus={`#rotate-${group.id}-${group.secretNames[0] ?? "close"}`}>
      <ModalHeader
        closeModal={onClose}
        iconDescription="Close"
        label={countLabel(groupRepos.length, "repo") + " will be updated"}
        title={`Rotate: ${group.name}`}
      />
      <ModalBody hasScrollingContent aria-label="New secret values">
        <Layer>
          <div style={{ display: "grid", gap: "1rem" }}>
            {group.secretNames.map((name: string) => (
              <PasswordInput
                key={name}
                id={`rotate-${group.id}-${name}`}
                labelText={<span className="cds--type-code-01">{name}</span>}
                value={values[name] ?? ""}
                placeholder="New value"
                onChange={(event) => setValues((prev) => ({ ...prev, [name]: event.target.value }))}
              />
            ))}
          </div>
          <h3 className="cds--label-01" style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>Target repositories</h3>
          <StructuredListWrapper isCondensed aria-label="Target repositories">
            <StructuredListBody>
              {groupRepos.map((repo) => {
                const result = results?.find((item) => item.repoId === repo.id);
                return (
                  <StructuredListRow key={repo.id}>
                    <StructuredListCell>
                      <span className="cds--type-code-01">{repo.fullName}</span>
                    </StructuredListCell>
                    <StructuredListCell>
                      {result ? (
                        result.ok ? (
                          <CheckmarkFilled size={16} style={{ color: "var(--cds-support-success)" }} aria-label="Updated" />
                        ) : (
                          <span title={result.error}>
                            <ErrorFilled size={16} style={{ color: "var(--cds-support-error)" }} aria-label={result.error ?? "Failed"} />
                          </span>
                        )
                      ) : rotating ? (
                        <InlineLoading description="Updating" status="active" />
                      ) : null}
                    </StructuredListCell>
                  </StructuredListRow>
                );
              })}
            </StructuredListBody>
          </StructuredListWrapper>
          {results && (
            <InlineNotification
              kind={results.every((result) => result.ok) ? "success" : "warning"}
              title={results.every((result) => result.ok) ? "Rotation complete" : "Rotation incomplete"}
              subtitle={
                results.every((result) => result.ok)
                  ? `All ${results.length} repos updated successfully.`
                  : `${succeeded}/${results.length} repos updated.`
              }
              hideCloseButton
              lowContrast
              style={{ marginTop: "1rem" }}
            />
          )}
        </Layer>
      </ModalBody>
      <ModalFooter>
        <Button type="button" kind="secondary" onClick={onClose}>
          Close
        </Button>
        {rotating ? (
          <Button type="button" kind="primary" disabled onClick={() => void doRotate()}>
            <InlineLoading description="Rotating..." status="active" />
          </Button>
        ) : (
          <Button type="button" kind="primary" renderIcon={Renew} disabled={!allFilled} onClick={() => void doRotate()}>
            Rotate in all repos
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}

function InventoryTab({
  repos,
  allSecrets,
  secretsLoading,
}: {
  repos: Repository[];
  allSecrets: SecretMeta[];
  secretsLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const scopedRepoIds = useMemo(() => new Set(repos.map((repo) => repo.id)), [repos]);
  const scopedSecrets = useMemo(() => allSecrets.filter((secret) => scopedRepoIds.has(secret.repositoryId)), [allSecrets, scopedRepoIds]);
  const secretNames = useMemo(() => Array.from(new Set(scopedSecrets.map((secret) => secret.name))).sort(), [scopedSecrets]);
  const reposWithSecrets = useMemo(
    () => repos.filter((repo) => scopedSecrets.some((secret) => secret.repositoryId === repo.id)),
    [repos, scopedSecrets],
  );
  const secretSet = useMemo(() => {
    const set = new Set<string>();
    for (const secret of scopedSecrets) set.add(`${secret.repositoryId}:${secret.name}`);
    return set;
  }, [scopedSecrets]);

  const normalizedQuery = query.trim().toLowerCase();
  const secretQueryHit = Boolean(normalizedQuery) && secretNames.some((name) => name.toLowerCase().includes(normalizedQuery));
  const visibleSecrets = secretQueryHit
    ? secretNames.filter((name) => name.toLowerCase().includes(normalizedQuery))
    : secretNames;
  const visibleRepos = normalizedQuery
    ? reposWithSecrets.filter((repo) => {
        const nameHit = repo.name.toLowerCase().includes(normalizedQuery) || repo.fullName.toLowerCase().includes(normalizedQuery);
        if (!secretQueryHit) return nameHit;
        return nameHit || visibleSecrets.some((name) => secretSet.has(`${repo.id}:${name}`));
      })
    : reposWithSecrets;

  if (secretsLoading) {
    return <InlineLoading description="Loading secret inventory" status="active" />;
  }

  if (secretNames.length === 0) {
    return (
      <InlineNotification
        kind="info"
        title="No secrets tracked"
        subtitle="Sync repositories with secrets to see the matrix."
        hideCloseButton
        lowContrast
      />
    );
  }

  return (
    <div>
      <Search
        id="secret-inventory-search"
        labelText="Find a repository or secret"
        placeholder="Filter the matrix"
        value={query}
        size="sm"
        onChange={(event) => setQuery(event.target.value)}
      />
      {visibleRepos.length === 0 ? (
        <InlineNotification
          kind="info"
          title="No matching secrets"
          subtitle={`Nothing matches “${query.trim()}”.`}
          hideCloseButton
          lowContrast
          style={{ marginTop: "1rem" }}
        />
      ) : (
        <div className="gitvisor-secrets-matrix" style={{ marginTop: "1rem" }}>
          <TableContainer>
            <Table size="sm" useZebraStyles>
              <TableHead>
                <TableRow>
                  <TableHeader className="gitvisor-secrets-sticky-col">Repository</TableHeader>
                  {visibleSecrets.map((name) => (
                    <TableHeader key={name} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <span className="cds--type-code-01">{name}</span>
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRepos.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell className="gitvisor-secrets-sticky-col" style={{ maxWidth: "12rem" }}>
                      <Link href={`/secrets?tab=repo&repositoryId=${repo.id}`} className="cds--link" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {repo.name}
                      </Link>
                    </TableCell>
                    {visibleSecrets.map((name) => (
                      <TableCell key={name} style={{ textAlign: "center" }}>
                        {secretSet.has(`${repo.id}:${name}`) ? (
                          <CheckmarkFilled size={16} style={{ color: "var(--cds-support-success)" }} aria-label={`${name} is present`} />
                        ) : (
                          <CircleDash size={16} style={{ color: "var(--cds-text-disabled)" }} aria-label={`${name} is not recorded`} />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}

function PerRepoTab({
  repos,
  allSecrets,
  secretsLoading,
}: {
  repos: Repository[];
  allSecrets: SecretMeta[];
  secretsLoading: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repositoryId = searchParams.get("repositoryId") ?? undefined;
  const [repoQuery, setRepoQuery] = useState("");
  const [secretQuery, setSecretQuery] = useState("");

  const { data: secrets, isLoading, error } = useQuery({
    queryKey: ["secrets", repositoryId],
    queryFn: () => getSecrets(repositoryId),
    enabled: !!repositoryId,
    staleTime: 30_000,
  });

  const secretCountByRepo = useMemo(() => {
    const map = new Map<string, number>();
    for (const secret of allSecrets) map.set(secret.repositoryId, (map.get(secret.repositoryId) ?? 0) + 1);
    return map;
  }, [allSecrets]);

  const reposWithSecrets = secretsLoading
    ? []
    : allSecrets.length > 0
      ? repos.filter((repo) => secretCountByRepo.has(repo.id))
      : repos;
  const selectedRepo = repos.find((repo) => repo.id === repositoryId);
  const normalizedRepoQuery = repoQuery.trim().toLowerCase();
  const normalizedSecretQuery = secretQuery.trim().toLowerCase();
  const visibleRepos = normalizedRepoQuery
    ? reposWithSecrets.filter((repo) => repo.fullName.toLowerCase().includes(normalizedRepoQuery) || repo.name.toLowerCase().includes(normalizedRepoQuery))
    : reposWithSecrets;
  const visibleSecrets = secrets && normalizedSecretQuery
    ? secrets.filter((secret) => secret.name.toLowerCase().includes(normalizedSecretQuery))
    : secrets;

  const repoOptions = useMemo<RepoChoice[]>(() => {
    const options = reposWithSecrets.map((repo) => ({ id: repo.id, text: repo.fullName }));
    if (repositoryId && !options.some((option) => option.id === repositoryId)) {
      options.unshift({ id: repositoryId, text: selectedRepo?.fullName ?? repositoryId });
    }
    return [{ id: "", text: "All repositories" }, ...options];
  }, [reposWithSecrets, repositoryId, selectedRepo]);
  const selectedRepoOption = repoOptions.find((option) => option.id === (repositoryId ?? "")) ?? repoOptions[0];

  function openRepository(nextId: string) {
    router.push(nextId ? `/secrets?tab=repo&repositoryId=${nextId}` : "/secrets?tab=repo");
  }

  return (
    <div>
      <div
        className="gitvisor-filter-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(16rem, 1.4fr) minmax(16rem, 1fr)",
          gap: "1rem",
          alignItems: "end",
        }}
      >
        <Search
          id="secret-repo-search"
          labelText={repositoryId ? "Find a secret" : "Find a repository"}
          placeholder={repositoryId ? "Filter secrets in this repository" : "Filter repositories"}
          value={repositoryId ? secretQuery : repoQuery}
          size="sm"
          onChange={(event) => {
            if (repositoryId) setSecretQuery(event.target.value);
            else setRepoQuery(event.target.value);
          }}
        />
        <Dropdown
          id="secrets-repository"
          titleText="Repository"
          label="All repositories"
          size="sm"
          items={repoOptions}
          itemToString={(item) => item?.text ?? ""}
          selectedItem={selectedRepoOption}
          onChange={({ selectedItem }) => {
            if (!selectedItem || selectedItem.id === (repositoryId ?? "")) return;
            openRepository(selectedItem.id);
          }}
        />
      </div>

      {!repositoryId ? (
        secretsLoading ? (
          <div style={{ marginTop: "1rem" }}>
            <InlineLoading description="Loading repositories" status="active" />
          </div>
        ) : (
          <div style={{ marginTop: "1rem" }}>
            {reposWithSecrets.length === 0 && (
              <InlineNotification kind="info" title="No secrets found" hideCloseButton lowContrast />
            )}
            {reposWithSecrets.length > 0 && visibleRepos.length === 0 && (
              <InlineNotification
                kind="info"
                title="No matching repositories"
                subtitle={`Nothing matches “${repoQuery.trim()}”.`}
                hideCloseButton
                lowContrast
              />
            )}
            {visibleRepos.length > 0 && (
              <CardGrid>
                {visibleRepos.map((repo) => {
                  const secretCount = secretCountByRepo.get(repo.id);
                  return (
                    <ClickableTile
                      key={repo.id}
                      href={`/secrets?tab=repo&repositoryId=${repo.id}`}
                      style={cardStyle}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        openRepository(repo.id);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flex: 1 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            {!repo.private && <Globe size={16} />}
                            <span className="cds--type-productive-heading-01" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{repo.fullName}</span>
                            {secretCount != null && (
                              <Tag size="sm" type="gray">{countLabel(secretCount, "secret")}</Tag>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={16} />
                      </div>
                    </ClickableTile>
                  );
                })}
              </CardGrid>
            )}
          </div>
        )
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <Button type="button" kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => openRepository("")}>
            All repositories
          </Button>
          <div style={{ marginTop: "1rem" }}>
            <p className="cds--type-productive-heading-02">{selectedRepo?.fullName ?? repositoryId}</p>
            <p className="cds--type-helper-text-01" style={{ marginTop: "0.25rem" }}>GitHub Actions secrets</p>
          </div>
          {isLoading && (
            <div style={{ marginTop: "1rem" }}>
              <InlineLoading description="Loading secrets" status="active" />
            </div>
          )}
          {error && (
            <InlineNotification
              kind="error"
              title="Failed to load secrets."
              hideCloseButton
              lowContrast
              style={{ marginTop: "1rem" }}
            />
          )}
          {secrets?.length === 0 && (
            <InlineNotification kind="info" title="No secrets" hideCloseButton lowContrast style={{ marginTop: "1rem" }} />
          )}
          {secrets && secrets.length > 0 && visibleSecrets?.length === 0 && (
            <InlineNotification
              kind="info"
              title="No matching secrets"
              subtitle={`Nothing matches “${secretQuery.trim()}”.`}
              hideCloseButton
              lowContrast
              style={{ marginTop: "1rem" }}
            />
          )}
          {visibleSecrets && visibleSecrets.length > 0 && selectedRepo && (
            <div style={{ marginTop: "1rem" }}>
              <CardGrid>
                {visibleSecrets.map((secret) => (
                  <SecretRow key={secret.name} secret={secret} repoId={Number(selectedRepo.githubRepoId)} />
                ))}
              </CardGrid>
            </div>
          )}
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
    <Tile style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <p className="cds--type-code-02">{secret.name}</p>
            <Tag size="sm" type={scopeTagType(secret.scope)}>{secret.scope}</Tag>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Button
            type="button"
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Edit}
            iconDescription="Update value"
            tooltipPosition="bottom"
            onClick={() => setEditing(!editing)}
          />
          {remove.isPending ? (
            <InlineLoading description="Deleting" status="active" />
          ) : (
            <Button
              type="button"
              kind="danger--ghost"
              size="sm"
              hasIconOnly
              renderIcon={TrashCan}
              iconDescription="Delete"
              tooltipPosition="bottom"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            />
          )}
        </div>
      </div>
      <p className="cds--type-helper-text-01" style={{ marginTop: "auto" }}>
        {secret.githubUpdatedAt ? `Updated ${new Date(secret.githubUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : null}
      </p>
      {editing && (
        <Layer>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 12rem", minWidth: 0 }}>
              <PasswordInput
                id={`secret-value-${repoId}-${secret.name}`}
                labelText="New secret value"
                value={value}
                placeholder="New secret value"
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            {update.isPending ? (
              <InlineLoading description="Saving secret" status="active" />
            ) : (
              <Button
                type="button"
                kind="ghost"
                size="sm"
                hasIconOnly
                renderIcon={Checkmark}
                iconDescription="Save secret"
                tooltipPosition="bottom"
                disabled={!value || update.isPending}
                onClick={() => update.mutate()}
              />
            )}
            <Button
              type="button"
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Close}
              iconDescription="Cancel edit"
              tooltipPosition="bottom"
              onClick={() => { setEditing(false); setValue(""); }}
            />
          </div>
        </Layer>
      )}
    </Tile>
  );
}

function SecretsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) ?? "groups";
  const { selected: selectedAccount } = useAccount();
  const matchedIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const tabIndex = matchedIndex === -1 ? 0 : matchedIndex;

  const { data: repos = [] } = useQuery({ queryKey: ["repositories"], queryFn: getRepositories, staleTime: 30_000 });
  const { data: allSecrets = [], isLoading: secretsLoading } = useQuery({
    queryKey: ["secrets", undefined],
    queryFn: () => getSecrets(),
    staleTime: 30_000,
  });

  const scopedRepos = useMemo(
    () => selectedAccount ? repos.filter((repo) => repo.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/")) : repos,
    [repos, selectedAccount],
  );

  return (
    <div>
      <PageHeader
        kicker="Credentials"
        title="Secrets"
        detail="Names and dates only. Raw values stay in GitHub."
      />

      <div style={{ marginTop: "1.5rem" }}>
        <Tabs
          selectedIndex={tabIndex}
          onChange={({ selectedIndex }) => {
            const next = TABS[selectedIndex];
            if (!next || next.id === activeTab) return;
            router.push(`/secrets?tab=${next.id}`);
          }}
        >
          <TabList aria-label="Secret views" contained>
            {TABS.map((tab) => (
              <Tab key={tab.id} renderIcon={tab.icon}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanels>
            <TabPanel>
              {activeTab === "groups" && <GroupsTab repos={scopedRepos} />}
            </TabPanel>
            <TabPanel>
              {activeTab === "inventory" && (
                <InventoryTab repos={scopedRepos} allSecrets={allSecrets} secretsLoading={secretsLoading} />
              )}
            </TabPanel>
            <TabPanel>
              {activeTab === "repo" && (
                <PerRepoTab repos={scopedRepos} allSecrets={allSecrets} secretsLoading={secretsLoading} />
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <style>{`
        .gitvisor-secrets-equal-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1rem;
          align-items: stretch;
        }
        .gitvisor-secrets-equal-grid > * {
          min-width: 0;
          height: 100%;
        }
        @media (min-width: 42rem) {
          .gitvisor-secrets-equal-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .gitvisor-secrets-matrix {
          overflow-x: auto;
        }
        .gitvisor-secrets-sticky-col {
          position: sticky;
          inset-inline-start: 0;
          z-index: 1;
          background: var(--cds-layer);
        }
      `}</style>
    </div>
  );
}

export default function SecretsPage() {
  return (
    <Suspense fallback={<InlineLoading description="Loading secrets" status="active" />}>
      <SecretsContent />
    </Suspense>
  );
}
