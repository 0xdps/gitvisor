import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  GitFork,
  Activity,
  CheckCircle2,
  XCircle,
  Github,
  ExternalLink,
} from "lucide-react";

interface PublicProfile {
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  stats: {
    repositoryCount: number;
    totalRuns: number;
    successCount: number;
    failureCount: number;
    workflowSuccessRate: number | null;
  };
}

async function fetchPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const apiBase =
    process.env["API_INTERNAL_URL"] ?? "http://localhost:3002";
  try {
    const res = await fetch(`${apiBase}/public/${encodeURIComponent(username)}`, {
      next: { revalidate: 300 }, // cache 5 minutes
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const { data } = (await res.json()) as { data: PublicProfile };
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchPublicProfile(username);

  if (!profile) {
    return { title: "User not found — Gitvisor" };
  }

  const displayName = profile.name ?? profile.githubUsername;
  const description = `${displayName}'s GitHub Actions dashboard on Gitvisor. ${profile.stats.totalRuns} workflow runs, ${profile.stats.repositoryCount} repositories.`;

  return {
    title: `${displayName} (@${profile.githubUsername}) — Gitvisor`,
    description,
    openGraph: {
      title: `${displayName} on Gitvisor`,
      description,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl }] : [],
    },
    twitter: {
      card: "summary",
      title: `${displayName} on Gitvisor`,
      description,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const successRate = profile.stats.workflowSuccessRate;
  const displayName = profile.name ?? profile.githubUsername;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Minimal header ───────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2 font-bold text-foreground">
            <img src="/icon-trans.png" alt="Gitvisor" className="h-6 w-6" />
            <span>Gitvisor</span>
          </a>
          <a
            href="/login"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* ── Profile header ───────────────────────────────────────── */}
        <div className="flex items-start gap-6 mb-10">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              className="h-24 w-24 rounded-full ring-2 ring-border shrink-0"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-muted ring-2 ring-border shrink-0 flex items-center justify-center text-3xl font-bold text-muted-foreground">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-muted-foreground">@{profile.githubUsername}</p>
            </div>
            <a
              href={`https://github.com/${profile.githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* ── Stats grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
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
              <span className="text-sm font-semibold tabular-nums text-primary">
                {successRate}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16 py-8 text-center text-xs text-muted-foreground">
        <a href="/" className="hover:text-foreground transition-colors">
          Gitvisor
        </a>{" "}
        — GitHub Actions visibility, simplified.
      </footer>
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
          ? "border-primary/30"
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
              ? "text-primary"
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
