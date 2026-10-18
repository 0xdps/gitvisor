"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type AttentionCategory = "all" | "ci" | "reviews" | "security" | "releases" | "setup";

export interface AttentionItem {
  id: string;
  severity: "critical" | "warning" | "info";
  category: Exclude<AttentionCategory, "all">;
  repo: string;
  title: string;
  reason: string;
  when: string;
  href: string;
  external?: boolean;
}

const SEVERITY = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-blue",
} as const;

export function AttentionInbox({ items }: { items: AttentionItem[] }) {
  const [category, setCategory] = useState<AttentionCategory>("all");
  const counts = useMemo(() => {
    const result: Record<AttentionCategory, number> = { all: items.length, ci: 0, reviews: 0, security: 0, releases: 0, setup: 0 };
    for (const item of items) result[item.category] += 1;
    return result;
  }, [items]);
  const visible = category === "all" ? items : items.filter((item) => item.category === category);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Attention</h2>
          <p className="text-[11px] text-muted-foreground">Ranked by what blocks shipping, then what is waiting or aging</p>
        </div>
        {(
          [
            ["all", "All"],
            ["ci", "CI"],
            ["reviews", "Reviews"],
            ["security", "Security"],
            ["releases", "Releases"],
            ["setup", "Setup"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategory(id)}
            className={`rounded-md px-2 py-1 font-mono text-[11px] ${
              category === id ? "bg-blue/15 text-blue" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label} {counts[id]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing in this queue.</p>
      ) : (
        <ol className="divide-y divide-border/70">
          {visible.slice(0, 12).map((item, index) => {
            const body = (
              <>
                <span className="w-5 font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                <span className={`w-16 font-mono text-[10px] uppercase tracking-wider ${SEVERITY[item.severity]}`}>{item.severity}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{item.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{item.repo} · {item.reason}</span>
                </span>
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">{item.when}</span>
              </>
            );
            return (
              <li key={item.id}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">{body}</a>
                ) : (
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">{body}</Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
