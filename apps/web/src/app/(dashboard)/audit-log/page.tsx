"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  GitBranch,
  KeyRound,
  Trash2,
  RefreshCw,
  Package,
  Globe,
  Lock,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getAuditLog } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/api-client";
import type { ElementType } from "react";

type ActionMeta = {
  label: string;
  icon: ElementType;
  category: string;
  dot: string;
};

function getActionMeta(action: string): ActionMeta {
  const map: Record<string, ActionMeta> = {
    "repository.synced_first":        { label: "New repo synced",      icon: GitBranch, category: "Repository", dot: "bg-blue" },
    "repository.synced_with_changes": { label: "Repo updated",         icon: RefreshCw, category: "Repository", dot: "bg-blue/60" },
    "repository.privatized":          { label: "Repo privatized",      icon: Lock,      category: "Repository", dot: "bg-muted-foreground/40" },
    "repository.publicized":          { label: "Repo made public",     icon: Globe,     category: "Repository", dot: "bg-muted-foreground/40" },
    "secret.upserted":                { label: "Secret set",           icon: KeyRound,  category: "Secret",     dot: "bg-warning" },
    "secret.deleted":                 { label: "Secret deleted",       icon: Trash2,    category: "Secret",     dot: "bg-destructive" },
    "workflow_run.rerun":             { label: "Workflow re-run",      icon: RefreshCw, category: "Workflow",   dot: "bg-success" },
    "workflow_run.cancelled":         { label: "Workflow cancelled",   icon: Zap,       category: "Workflow",   dot: "bg-muted-foreground/40" },
    "installation.created":           { label: "App installed",        icon: Package,   category: "App",        dot: "bg-success" },
    "installation.deleted":           { label: "App removed",          icon: Trash2,    category: "App",        dot: "bg-destructive" },
  };
  return map[action] ?? { label: action, icon: Zap, category: "System", dot: "bg-muted-foreground/30" };
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={null}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => getAuditLog(page),
    staleTime: 30_000,
  });

  const entries = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  // Group entries by date
  const grouped = entries.reduce<{ date: string; items: AuditEntry[] }[]>((acc, entry) => {
    const date = new Date(entry.createdAt).toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric",
    });
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.items.push(entry);
    } else {
      acc.push({ date, items: [entry] });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
        {data && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.total.toLocaleString()} event{data.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center py-16 text-center px-6">
          <Zap className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No events yet</p>
          <p className="mt-1 text-xs text-muted-foreground/50">Actions will appear here as you use Gitvisor.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2 px-1">
                {date}
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
                {items.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <a
              href={`/audit-log${page > 2 ? `?page=${page - 1}` : ""}`}
              aria-disabled={page <= 1}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${page <= 1 ? "pointer-events-none opacity-30" : "hover:bg-accent hover:text-foreground"}`}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </a>
            <a
              href={`/audit-log?page=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${page >= totalPages ? "pointer-events-none opacity-30" : "hover:bg-accent hover:text-foreground"}`}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AuditRow ───────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const meta = getActionMeta(entry.action);
  const Icon = meta.icon;

  const time = new Date(entry.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/2 transition-colors">
      {/* Category icon */}
      <div className="shrink-0 h-7 w-7 rounded-lg bg-muted/20 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>

      {/* Label + resource */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{meta.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground/50 font-medium">{meta.category}</span>
          {entry.resourceId && (
            <>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <span className="text-[11px] text-muted-foreground/50 font-mono truncate">{entry.resourceId}</span>
            </>
          )}
        </div>
      </div>

      {/* Dot + time */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        <p className="text-xs text-muted-foreground tabular-nums">{time}</p>
      </div>
    </div>
  );
}
