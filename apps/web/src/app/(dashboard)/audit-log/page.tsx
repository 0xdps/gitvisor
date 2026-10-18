"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Branch,
  Password,
  TrashCan,
  Renew,
  Package,
  Globe,
  Locked,
  Flash,
  ChevronLeft,
  ChevronRight,
  Login,
  Logout,
  Security,
} from "@carbon/icons-react";
import {
  Button,
  InlineLoading,
  InlineNotification,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from "@carbon/react";
import { getAuditLog } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/api-client";
import type { ElementType } from "react";
import { PageHeader } from "@/components/page-header";

type ActionMeta = {
  label: string;
  icon: ElementType;
  category: string;
  type: "blue" | "green" | "red" | "magenta" | "gray";
};

function getActionMeta(action: string): ActionMeta {
  const map: Record<string, ActionMeta> = {
    "repository.synced_first":        { label: "New repo synced",      icon: Branch,     category: "Repository", type: "blue" },
    "repository.synced_with_changes": { label: "Repo updated",         icon: Renew,      category: "Repository", type: "blue" },
    "repository.privatized":          { label: "Repo privatized",      icon: Locked,     category: "Repository", type: "gray" },
    "repository.publicized":          { label: "Repo made public",     icon: Globe,      category: "Repository", type: "gray" },
    "secret.upserted":                { label: "Secret set",           icon: Password,   category: "Secret",     type: "magenta" },
    "secret.deleted":                 { label: "Secret deleted",       icon: TrashCan,   category: "Secret",     type: "red" },
    "workflow_run.rerun":             { label: "Workflow re-run",      icon: Renew,      category: "Workflow",   type: "green" },
    "workflow_run.cancelled":         { label: "Workflow cancelled",   icon: Flash,      category: "Workflow",   type: "gray" },
    "installation.created":           { label: "App installed",        icon: Package,    category: "App",        type: "green" },
    "installation.deleted":           { label: "App removed",          icon: TrashCan,   category: "App",        type: "red" },
    // Auth / security events
    "auth.login":                     { label: "Signed in",            icon: Login,      category: "Auth",       type: "blue" },
    "auth.logout":                    { label: "Signed out",           icon: Logout,     category: "Auth",       type: "gray" },
    "security.alert":                 { label: "Security alert",       icon: Security,   category: "Security",  type: "red" },
  };
  return map[action] ?? { label: action, icon: Flash, category: "System", type: "gray" };
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<InlineLoading description="Loading audit log" />}>
      <AuditLogContent />
    </Suspense>
  );
}

function AuditLogContent() {
  const searchParams = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const { data, isLoading, isError } = useQuery({
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
    <div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <PageHeader
        kicker="Record"
        title="Audit log"
        detail={data ? `${data.total.toLocaleString()} event${data.total !== 1 ? "s" : ""}` : null}
      />

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      {isError ? (
        <InlineNotification kind="error" title="Audit log not loaded" subtitle="Check your connection and try again." hideCloseButton lowContrast style={{ marginTop: "1.5rem" }} />
      ) : isLoading ? (
        <div style={{ marginTop: "1.5rem" }}><InlineLoading description="Loading audit events" /></div>
      ) : entries.length === 0 ? (
        <InlineNotification kind="info" title="No events yet" subtitle="Actions will appear here as you use Gitvisor." hideCloseButton lowContrast style={{ marginTop: "1.5rem" }} />
      ) : (
        <div style={{ marginTop: "1.5rem" }}>
          {grouped.map(({ date, items }) => (
            <section key={date} style={{ marginTop: "1.5rem" }}>
              <h2 className="cds--label-01" style={{ marginBottom: "0.5rem" }}>
                {date}
              </h2>
              <StructuredListWrapper isCondensed>
                <StructuredListBody>
                {items.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
                </StructuredListBody>
              </StructuredListWrapper>
            </section>
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button
              as="a"
              href={`/audit-log${page > 2 ? `?page=${page - 1}` : ""}`}
              disabled={page <= 1}
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={ChevronLeft}
              iconDescription="Previous page"
            />
            <Button
              as="a"
              href={`/audit-log?page=${page + 1}`}
              disabled={page >= totalPages}
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={ChevronRight}
              iconDescription="Next page"
            />
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
    <StructuredListRow>
      {/* Category icon */}
      <StructuredListCell noWrap><Icon size={16} /></StructuredListCell>

      {/* Label + resource */}
      <StructuredListCell>
        <span className="cds--type-body-compact-01">{meta.label}</span>
        <span className="cds--helper-text" style={{ display: "block" }}>
          {meta.category}
          {entry.resourceId && (
            <>
              {" · "}
              <span className="font-mono">{entry.resourceId}</span>
            </>
          )}
        </span>
      </StructuredListCell>

      {/* Dot + time */}
      <StructuredListCell noWrap><Tag size="sm" type={meta.type}>{meta.category}</Tag></StructuredListCell>
      <StructuredListCell noWrap>{time}</StructuredListCell>
    </StructuredListRow>
  );
}
