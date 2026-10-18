"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ContentSwitcher,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Switch,
  Tag,
} from "@carbon/react";
import { LIST_PAGE_SIZE, ListPagination, stableListStyle, stableSlots, usePagedSlice } from "@/components/ops/activity-feed";

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

const CATEGORIES = [
  ["all", "All"],
  ["ci", "CI"],
  ["reviews", "Reviews"],
  ["security", "Security"],
  ["releases", "Releases"],
  ["setup", "Setup"],
] as const;

const TAG: Record<AttentionItem["severity"], "red" | "magenta" | "blue"> = {
  critical: "red",
  warning: "magenta",
  info: "blue",
};

export function AttentionInbox({ items }: { items: AttentionItem[] }) {
  const [category, setCategory] = useState<AttentionCategory>("all");
  const counts = useMemo(() => {
    const result: Record<AttentionCategory, number> = { all: items.length, ci: 0, reviews: 0, security: 0, releases: 0, setup: 0 };
    for (const item of items) result[item.category] += 1;
    return result;
  }, [items]);
  const filtered = useMemo(
    () => (category === "all" ? items : items.filter((item) => item.category === category)),
    [items, category],
  );
  const { page, visible, setPage } = usePagedSlice(filtered);
  const slots = stableSlots(items.length);
  const selectedIndex = CATEGORIES.findIndex(([id]) => id === category);

  return (
    <section className="gitvisor-stable-section">
      <h2 className="cds--type-productive-heading-02">Attention</h2>
      <p className="cds--helper-text">Ranked by what blocks shipping, then what is waiting or aging</p>
      <div className="gitvisor-switcher">
        <ContentSwitcher
          size="sm"
          selectedIndex={selectedIndex}
          onChange={({ index }) => {
            if (index === undefined) return;
            const next = CATEGORIES[index]?.[0];
            if (next) setCategory(next);
          }}
        >
          {CATEGORIES.map(([id, label]) => (
            <Switch key={id} name={id} text={`${label} ${counts[id]}`} />
          ))}
        </ContentSwitcher>
      </div>
      <div className="gitvisor-fixed-list" style={stableListStyle(slots)}>
        {visible.length === 0 ? (
          <p className="cds--type-body-01">Nothing in this queue.</p>
        ) : (
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
              {visible.map((item, index) => {
                const title = item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                ) : (
                  <Link href={item.href}>{item.title}</Link>
                );
                const detail = `${item.repo} · ${item.reason}`;
                return (
                  <StructuredListRow key={item.id}>
                    <StructuredListCell noWrap className="gitvisor-col-index">
                      {page * LIST_PAGE_SIZE + index + 1}
                    </StructuredListCell>
                    <StructuredListCell noWrap className="gitvisor-col-tag">
                      <Tag size="sm" type={TAG[item.severity]}>
                        {item.severity}
                      </Tag>
                    </StructuredListCell>
                    <StructuredListCell className="gitvisor-clip-cell">
                      <span className="cds--type-body-compact-01 gitvisor-clip" title={item.title}>
                        {title}
                      </span>
                      <span className="cds--helper-text gitvisor-clip" title={detail}>
                        {detail}
                      </span>
                    </StructuredListCell>
                    <StructuredListCell noWrap className="gitvisor-col-when">
                      {item.when}
                    </StructuredListCell>
                  </StructuredListRow>
                );
              })}
            </StructuredListBody>
          </StructuredListWrapper>
        )}
      </div>
      <ListPagination
        page={page}
        total={filtered.length}
        onChange={setPage}
        pinned={items.length > LIST_PAGE_SIZE}
      />
    </section>
  );
}
