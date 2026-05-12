"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { getAuditLog } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/api-client";

function AuditLogContent() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => getAuditLog(page),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A record of all actions taken in your GitVisor account.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load audit log.
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No audit events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Events will appear here as you use GitVisor.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {data.items.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>

          {(data.page > 1 || data.items.length === data.perPage) && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                {data.total} total events
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?page=${page - 1}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-accent transition-colors"
                  >
                    Previous
                  </a>
                )}
                {data.items.length === data.perPage && (
                  <a
                    href={`?page=${page + 1}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-accent transition-colors"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-accent/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded mr-2">
            {entry.action}
          </span>
          <span className="text-muted-foreground text-xs">
            {entry.resourceType}
          </span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground shrink-0">
        {new Date(entry.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg border border-border bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      }
    >
      <AuditLogContent />
    </Suspense>
  );
}
