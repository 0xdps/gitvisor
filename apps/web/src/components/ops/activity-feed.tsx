"use client";

import { timeAgo } from "@/lib/format";
import { PaginationNav, StructuredListBody, StructuredListCell, StructuredListRow, StructuredListWrapper, Tag } from "@carbon/react";
import { useEffect, useState, type CSSProperties } from "react";

export const LIST_PAGE_SIZE = 10;

/** How many rows the section should reserve. Tabs and short pages keep this height. */
export function stableSlots(total: number, pageSize = LIST_PAGE_SIZE) {
  if (total <= 0) return 0;
  return Math.min(pageSize, total);
}

export function stableListStyle(slots: number): CSSProperties {
  return { "--gitvisor-slots": String(slots) } as CSSProperties;
}

export interface ActivityItem {
  id: string;
  at: string;
  kind: "run-pass" | "run-fail" | "run-live" | "release" | "action";
  title: string;
  detail: string;
  href?: string;
}

const KIND: Record<ActivityItem["kind"], { label: string; type: "green" | "red" | "blue" | "gray" }> = {
  "run-pass": { label: "build", type: "green" },
  "run-fail": { label: "build", type: "red" },
  "run-live": { label: "build", type: "blue" },
  release: { label: "release", type: "blue" },
  action: { label: "gitvisor", type: "gray" },
};

export function usePagedSlice<T>(items: T[], pageSize = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const resetKey = `${pageSize}:${items.length}:${itemKey(items[0])}:${itemKey(items.at(-1))}`;

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  return {
    page: safePage,
    pageSize,
    visible: items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    setPage,
  };
}

function itemKey(item: unknown) {
  if (item && typeof item === "object" && "id" in item) return String(item.id);
  return "";
}

export function ListPagination({
  page,
  total,
  onChange,
  pinned = false,
  pageSize = LIST_PAGE_SIZE,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  /** Keep the pager row even when this view has a single page, so the row does not pop in. */
  pinned?: boolean;
  pageSize?: number;
}) {
  if (!pinned && total <= pageSize) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="gitvisor-fixed-pager">
      <span className="cds--helper-text">{total === 0 ? "0 results" : `${start}–${end} of ${total}`}</span>
      <PaginationNav
        page={Math.min(page, pageCount - 1)}
        totalItems={pageCount}
        itemsShown={4}
        size="sm"
        onChange={onChange}
      />
    </div>
  );
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const { page, visible, setPage } = usePagedSlice(items);
  const slots = stableSlots(items.length);
  return (
    <section className="gitvisor-stable-section">
      <h2 className="cds--type-productive-heading-02">Activity</h2>
      <p className="cds--helper-text">Latest builds, releases, and changes made through Gitvisor</p>
      {items.length === 0 ? (
        <p className="cds--type-body-01" style={{ marginTop: "1.5rem" }}>
          No activity yet.
        </p>
      ) : (
        <div className="gitvisor-fixed-list" style={stableListStyle(slots)}>
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
              {visible.map((item) => (
                <StructuredListRow key={item.id}>
                  <StructuredListCell noWrap className="gitvisor-col-tag">
                    <Tag size="sm" type={KIND[item.kind].type}>
                      {KIND[item.kind].label}
                    </Tag>
                  </StructuredListCell>
                  <StructuredListCell className="gitvisor-clip-cell">
                    <span className="gitvisor-clip" title={item.title}>
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </span>
                    <span className="cds--helper-text gitvisor-clip" title={item.detail}>
                      {item.detail}
                    </span>
                  </StructuredListCell>
                  <StructuredListCell noWrap className="gitvisor-col-when">
                    {timeAgo(item.at)}
                  </StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        </div>
      )}
      <ListPagination page={page} total={items.length} onChange={setPage} />
    </section>
  );
}
