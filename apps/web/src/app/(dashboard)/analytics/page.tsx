"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart2, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { getProfile } from "@/lib/api-client";
import type { Profile } from "@/lib/api-client";

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your workflow activity and package metrics.
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load analytics.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Repositories"
              value={data.stats.repositoryCount}
              icon={<BarChart2 className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Total Runs"
              value={data.stats.totalRuns}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Successful"
              value={data.stats.successCount}
              accent="green"
              icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
            />
            <StatCard
              label="Failed"
              value={data.stats.failureCount}
              accent="red"
              icon={<XCircle className="h-4 w-4 text-destructive" />}
            />
          </div>

          {data.stats.workflowSuccessRate !== null && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Workflow success rate
                </p>
                <span className="text-sm font-semibold tabular-nums text-primary">
                  {data.stats.workflowSuccessRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${data.stats.workflowSuccessRate}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
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
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
