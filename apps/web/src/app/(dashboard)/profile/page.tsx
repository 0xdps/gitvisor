"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ExternalLink,
  GitFork,
  Lock,
  CheckCircle2,
  XCircle,
  Activity,
  Github,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from "@gitvisor/ui";
import { getProfile, getRepositories, getWorkflowRuns } from "@/lib/api-client";
import { me } from "@/lib/auth-client";
import type { Repository } from "@gitvisor/shared";
import type { WorkflowRun, WorkflowRunConclusion } from "@gitvisor/shared";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: string, conclusion: WorkflowRunConclusion): string {
  if (status === "in_progress") return "text-amber-400 border-amber-900/50 bg-amber-950/30";
  if (conclusion === "success") return "text-blue border-blue/20 bg-blue/5";
  if (conclusion === "failure" || conclusion === "timed_out")
    return "text-destructive border-destructive/20 bg-destructive/5";
  return "text-muted-foreground";
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 60_000,
  });

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 60_000,
  });

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
  });

  const { data: workflowData } = useQuery({
    queryKey: ["workflows", { page: 1, perPage: 6 }],
    queryFn: () => getWorkflowRuns({ page: 1, perPage: 6 }),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-8 animate-pulse">
        <div className="w-64 shrink-0 space-y-4">
          <div className="h-32 w-32 rounded-full bg-muted" />
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const memberSince = user?.createdAt
    ? formatMemberSince(new Date(user.createdAt))
    : null;
  const successRate = profile.stats.workflowSuccessRate;

  return (
    <div className="flex gap-8 items-start">
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 space-y-5">
        <Avatar className="h-[240px] w-[240px] rounded-full ring-2 ring-border">
          <AvatarImage
            src={profile.avatarUrl ?? undefined}
            alt={profile.name ?? profile.githubUsername}
            className="object-cover"
          />
          <AvatarFallback className="text-4xl rounded-full">
            {getInitials(profile.name ?? profile.githubUsername)}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1">
          <h1 className="text-xl font-bold leading-tight">
            {profile.name ?? profile.githubUsername}
          </h1>
          <p className="text-muted-foreground text-sm">
            @{profile.githubUsername}
          </p>
        </div>

        <a
          href={`https://github.com/${profile.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Github className="h-4 w-4" />
          View GitHub Profile
          <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
        </a>

        {memberSince && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Member since {memberSince}</span>
          </div>
        )}
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Repositories"
            value={profile.stats.repositoryCount}
            icon={<GitFork className="h-4 w-4" />}
          />
          <StatCard
            label="Total Runs"
            value={profile.stats.totalRuns}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label="Successful"
            value={profile.stats.successCount}
            accent="green"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Failed"
            value={profile.stats.failureCount}
            accent="red"
            icon={<XCircle className="h-4 w-4" />}
          />
        </div>

        {successRate !== null && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workflow success rate
              </p>
              <span className="text-sm font-semibold tabular-nums text-blue">
                {successRate}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        )}

        {repos && repos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Repositories</h2>
              <Link
                href="/repositories"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {repos.slice(0, 6).map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </section>
        )}

        {workflowData && workflowData.items.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Workflow Runs</h2>
              <Link
                href="/workflows"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {workflowData.items.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent/30 transition-colors"
                >
                  <RunStatusDot
                    status={run.status}
                    conclusion={run.conclusion}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {run.workflowName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {run.branch}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusColor(run.status, run.conclusion)}`}
                    >
                      {run.conclusion ?? run.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(run.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "green" | "red";
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 flex flex-col gap-2 ${
        accent === "green"
          ? "border-blue/30"
          : accent === "red"
            ? "border-destructive/25"
            : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <span
          className={
            accent === "green"
              ? "text-blue"
              : accent === "red"
                ? "text-destructive"
                : "text-muted-foreground"
          }
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function RepoCard({ repo }: { repo: Repository }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/workflows?repositoryId=${repo.id}`}
          className="text-sm font-semibold text-foreground hover:text-blue hover:underline truncate"
        >
          {repo.name}
        </Link>
        {repo.private ? (
          <Badge
            variant="outline"
            className="text-xs shrink-0 flex items-center gap-1"
          >
            <Lock className="h-2.5 w-2.5" />
            Private
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs shrink-0">
            Public
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{repo.owner}</p>
    </div>
  );
}

function RunStatusDot({
  status,
  conclusion,
}: {
  status: string;
  conclusion: WorkflowRunConclusion;
}) {
  const color =
    status === "in_progress"
      ? "bg-amber-400"
      : conclusion === "success"
        ? "bg-blue"
        : conclusion === "failure" || conclusion === "timed_out"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />;
}
