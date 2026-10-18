import Link from "next/link";
import type { ElementType, ReactNode } from "react";

export type Tone = "neutral" | "good" | "warn" | "bad" | "live";

const TONE_COLOR: Record<Tone, string | undefined> = {
  neutral: undefined,
  good: "var(--cds-support-success)",
  warn: "var(--cds-support-warning)",
  bad: "var(--cds-support-error)",
  live: "var(--cds-interactive)",
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
    <Link href={href} className="cds--tile cds--tile--clickable" style={{ display: "flex", flexDirection: "column" }}>
      <span className="cds--label-01" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Icon size={16} />
        {label}
      </span>
      <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span className="cds--type-productive-heading-05" style={{ color: TONE_COLOR[tone] }}>
          {value}
        </span>
        {unit ? <span className="cds--helper-text">{unit}</span> : null}
      </div>
      {children ? <div style={{ marginTop: "0.75rem" }}>{children}</div> : null}
      <div style={{ flex: 1, minHeight: "1rem" }} />
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem 0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--cds-border-subtle-01)",
        }}
      >
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="cds--helper-text">{fact.label}</dt>
            <dd className="cds--type-body-compact-01" style={{ color: TONE_COLOR[fact.tone ?? "neutral"] }}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "2.5rem" }} aria-hidden="true">
      {values.map((v, i) => {
        const h = v.total === 0 ? 4 : Math.max(10, (v.total / max) * 100);
        const badShare = v.total === 0 ? 0 : (v.total - v.good) / v.total;
        return (
          <div
            key={v.label}
            title={`${v.label}: ${v.good}/${v.total} passed`}
            style={{
              position: "relative",
              flex: 1,
              overflow: "hidden",
              height: `${h}%`,
              background: v.total === 0 ? "var(--cds-border-subtle-01)" : "var(--cds-support-success)",
              outline: highlight === i ? "1px solid var(--cds-interactive)" : undefined,
            }}
          >
            {badShare > 0 ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: `${badShare * 100}%`,
                  background: "var(--cds-support-error)",
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Meter({ parts }: { parts: { value: number; className: string; label: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total === 0) return <div style={{ height: "0.25rem", background: "var(--cds-border-subtle-01)" }} />;
  return (
    <div style={{ display: "flex", height: "0.25rem", overflow: "hidden", background: "var(--cds-border-subtle-01)" }} aria-hidden="true">
      {parts.map((part) =>
        part.value > 0 ? (
          <span key={part.label} title={`${part.label}: ${part.value}`} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}
