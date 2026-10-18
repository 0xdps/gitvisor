import Link from "next/link";
import type { ElementType, ReactNode } from "react";

export type Tone = "neutral" | "good" | "warn" | "bad" | "live";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  live: "text-blue",
};

const TONE_EDGE: Record<Tone, string> = {
  neutral: "border-border",
  good: "border-border",
  warn: "border-warning/35",
  bad: "border-destructive/40",
  live: "border-blue/35",
};

export function DomainPanel({
  icon: Icon,
  label,
  href,
  value,
  unit,
  tone = "neutral",
  facts,
  children,
}: {
  icon: ElementType;
  label: string;
  href: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  facts: { label: string; value: ReactNode; tone?: Tone }[];
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-white/[0.03] ${TONE_EDGE[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">
          Open
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`font-mono text-3xl leading-none ${TONE_TEXT[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-auto pt-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="truncate text-[10px] text-muted-foreground">{f.label}</dt>
              <dd className={`truncate font-mono text-xs ${TONE_TEXT[f.tone ?? "neutral"]}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Link>
  );
}

export function SparkBars({
  values,
  highlight,
}: {
  values: { total: number; good: number; label: string }[];
  highlight?: number;
}) {
  const max = Math.max(1, ...values.map((v) => v.total));
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => {
        const h = v.total === 0 ? 4 : Math.max(10, (v.total / max) * 100);
        const badShare = v.total === 0 ? 0 : (v.total - v.good) / v.total;
        return (
          <div
            key={v.label}
            title={`${v.label}: ${v.good}/${v.total} passed`}
            className={`relative flex-1 overflow-hidden rounded-[2px] ${v.total === 0 ? "bg-white/5" : "bg-success/70"} ${
              highlight === i ? "ring-1 ring-blue" : ""
            }`}
            style={{ height: `${h}%` }}
          >
            {badShare > 0 && (
              <span className="absolute inset-x-0 top-0 bg-destructive" style={{ height: `${badShare * 100}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Meter({ parts }: { parts: { value: number; className: string; label: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <div className="h-1.5 rounded-full bg-white/5" />;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
      {parts.map((p) =>
        p.value > 0 ? (
          <span key={p.label} title={`${p.label}: ${p.value}`} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}
