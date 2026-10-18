import { timeAgo } from "@/lib/format";

export interface ActivityItem {
  id: string;
  at: string;
  kind: "run-pass" | "run-fail" | "run-live" | "release" | "action";
  title: string;
  detail: string;
  href?: string;
}

const DOT: Record<ActivityItem["kind"], string> = {
  "run-pass": "bg-success",
  "run-fail": "bg-destructive",
  "run-live": "bg-blue animate-pulse",
  release: "bg-blue",
  action: "bg-muted-foreground",
};

const KIND: Record<ActivityItem["kind"], string> = {
  "run-pass": "build",
  "run-fail": "build",
  "run-live": "build",
  release: "release",
  action: "gitvisor",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Activity</h2>
        <p className="text-[11px] text-muted-foreground">Builds, releases, and changes made through Gitvisor</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative max-h-[420px] overflow-y-auto px-4 py-3">
          <span className="absolute bottom-3 left-[19px] top-3 w-px bg-border" aria-hidden="true" />
          {items.map((item) => {
            const body = (
              <>
                <span className={`relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-card ${DOT[item.kind]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{item.title}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">{KIND[item.kind]}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(item.at)}</p>
                </div>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-2 flex gap-3 rounded-md px-2 py-2 hover:bg-white/[0.03]"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="-mx-2 flex gap-3 px-2 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
