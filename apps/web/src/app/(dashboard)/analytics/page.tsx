"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getRepositories } from "@/lib/api-client";
import { TrendingUp, TrendingDown, Activity, GitBranch, CheckCircle2, XCircle } from "lucide-react";
import type React from "react";
import { useAccount } from "@/lib/account-context";

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics", 30],
    queryFn: () => getAnalytics(30),
    staleTime: 60_000,
  });

  const { data: repos } = useQuery({
    queryKey: ["repositories"],
    queryFn: getRepositories,
    staleTime: 60_000,
  });

  const { selected: selectedAccount } = useAccount();
  const allRepos = repos ?? [];
  const scopedRepos = selectedAccount
    ? allRepos.filter((r) => r.fullName.toLowerCase().startsWith(selectedAccount.login.toLowerCase() + "/"))
    : allRepos;
  const scopedRepoIds = new Set(scopedRepos.map((r) => r.id));

  const repoMap = new Map(allRepos.map((r) => [r.id, r.fullName]));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/20 rounded animate-pulse" />
        <div className="h-24 bg-muted/10 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/10 rounded-xl animate-pulse" />
        <div className="h-48 bg-muted/10 rounded-xl animate-pulse" />
      </div>
    );
  }

  const allByRepo = analytics?.byRepo ?? [];
  const byRepo = selectedAccount
    ? allByRepo.filter((r) => scopedRepoIds.has(r.repositoryId))
    : allByRepo;
  const byDay  = analytics?.byDay ?? [];

  const total   = byRepo.reduce((s, r) => s + r.total, 0);
  const success = byRepo.reduce((s, r) => s + r.success, 0);
  const failure = byRepo.reduce((s, r) => s + r.failure, 0);
  const successRate = total > 0 ? Math.round((success / total) * 100) : null;

  if (total === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-20 text-center px-6">
          <Activity className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No data yet</p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            Analytics will appear after your first workflow run.
          </p>
        </div>
      </div>
    );
  }

  const rateColor =
    successRate == null  ? "text-foreground"
    : successRate >= 80  ? "text-success"
    : successRate >= 50  ? "text-warning"
    : "text-destructive";

  const grade =
    successRate == null  ? null
    : successRate >= 90  ? { label: "Excellent", icon: TrendingUp,   color: "text-success",     bg: "bg-success/10",     border: "border-success/20" }
    : successRate >= 75  ? { label: "Good",      icon: TrendingUp,   color: "text-blue",        bg: "bg-blue/10",        border: "border-blue/20" }
    : successRate >= 50  ? { label: "Fair",       icon: TrendingDown, color: "text-warning",     bg: "bg-warning/10",     border: "border-warning/20" }
    :                      { label: "Poor",       icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" };

  const successPct = total > 0 ? (success / total) * 100 : 0;
  const failurePct = total > 0 ? (failure / total) * 100 : 0;

  // Build a dense 30-day array (fill in missing dates with 0)
  const today = new Date();
  const daySlots: { date: string; total: number; success: number }[] = [];
  const dayMap = new Map(byDay.map((d) => [d.date, d]));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daySlots.push(dayMap.get(key) ?? { date: key, total: 0, success: 0 });
  }
  const maxDayTotal = Math.max(1, ...daySlots.map((d) => d.total));

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Last 30 days · {total.toLocaleString()} runs across {byRepo.length} {byRepo.length === 1 ? "repo" : "repos"}
        </p>
      </div>

      {/* ── Stat strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
        <MetricBlock label="Total Runs"   value={total}        icon={Activity} />
        <MetricBlock label="Repositories" value={byRepo.length} icon={GitBranch} />
        <MetricBlock label="Successful"   value={success}      icon={CheckCircle2} valueClass="text-success"     sub={`${Math.round(successPct)}%`} />
        <MetricBlock label="Failed"       value={failure}      icon={XCircle}      valueClass={failure > 0 ? "text-destructive" : undefined} sub={`${Math.round(failurePct)}%`} />
      </div>

      {/* ── 30-day sparkbar chart ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Daily runs — last 30 days</p>
          {grade && (
            <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${grade.bg} ${grade.border}`}>
              <grade.icon className={`h-3.5 w-3.5 ${grade.color}`} />
              <span className={`text-xs font-semibold ${grade.color}`}>{successRate}% · {grade.label}</span>
            </div>
          )}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-0.5 h-24">
          {daySlots.map((day) => {
            const heightPct = day.total === 0 ? 4 : Math.max(8, (day.total / maxDayTotal) * 100);
            const successFrac = day.total > 0 ? day.success / day.total : 0;
            const barColor = day.total === 0
              ? "bg-border"
              : successFrac >= 0.8
              ? "bg-success"
              : successFrac >= 0.5
              ? "bg-warning"
              : "bg-destructive/70";
            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.total} runs (${day.success} success)`}
                className="flex-1"
                style={{ height: `${heightPct}%` }}
              >
                <div className={`w-full h-full rounded-sm ${barColor}`} />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/50 tabular-nums">
          <span>{daySlots[0]?.date.slice(5)}</span>
          <span>{daySlots[14]?.date.slice(5)}</span>
          <span>{daySlots[29]?.date.slice(5)}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />≥ 80% success</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-warning" />50–79%</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-destructive/70" />&lt; 50%</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-border" />no runs</span>
        </div>
      </div>

      {/* ── Per-repo breakdown ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold">Repos by activity</p>
        </div>
        <div className="divide-y divide-border/50">
          {byRepo.map((row) => {
            const repoName = repoMap.get(row.repositoryId) ?? row.repositoryId;
            const rate = row.total > 0 ? Math.round((row.success / row.total) * 100) : null;
            const rColor = rate == null ? "text-muted-foreground" : rate >= 80 ? "text-success" : rate >= 50 ? "text-warning" : "text-destructive";
            const barSPct = row.total > 0 ? (row.success / row.total) * 100 : 0;
            const barFPct = row.total > 0 ? (row.failure / row.total) * 100 : 0;
            return (
              <div key={row.repositoryId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{repoName}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-muted/30 overflow-hidden flex">
                    <div className="h-full bg-success"        style={{ width: `${barSPct}%` }} />
                    <div className="h-full bg-destructive/70" style={{ width: `${barFPct}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-sm font-bold tabular-nums ${rColor}`}>
                    {rate != null ? `${rate}%` : "—"}
                  </span>
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {row.total.toLocaleString()} runs
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ── MetricBlock ────────────────────────────────────────────────────────────────

function MetricBlock({
  label, value, icon: Icon, valueClass, sub,
}: {
  label: string; value: number; icon: React.ElementType; valueClass?: string | undefined; sub?: string | undefined;
}) {
  return (
    <div className="bg-card px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/30" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-2xl font-black tabular-nums leading-none ${valueClass ?? "text-foreground"}`}>
          {value.toLocaleString()}
        </p>
        {sub && <span className="text-sm text-muted-foreground/60 font-medium">{sub}</span>}
      </div>
    </div>
  );
}


