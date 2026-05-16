"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock, PlusCircle, RefreshCw } from "lucide-react";
import { getInstallations } from "@/lib/api-client";
import { useUpgradeModal } from "./upgrade-modal";

export function InstallAccountsPanel() {
  const { data: installations = [], isLoading, refetch } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const { openUpgradeModal } = useUpgradeModal();

  const baseInstallUrl =
    installations.find((a) => a.installUrl)?.installUrl?.replace(
      /\/installations\/new\/permissions.*$/,
      "/installations/new",
    ) ?? null;

  const allInstalled = installations.length > 0 && installations.every((a) => a.installed);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border animate-pulse">
          <div className="h-4 w-28 bg-muted/40 rounded" />
          <div className="h-3 w-44 bg-muted/30 rounded mt-1.5" />
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="px-4 py-2.5 flex items-center gap-2.5 border-b last:border-0 border-border/50 animate-pulse"
          >
            <div className="h-6 w-6 rounded-full bg-muted/40 shrink-0" />
            <div className="h-3 w-24 bg-muted/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (installations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Connect GitHub App</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {allInstalled
              ? "All accounts connected"
              : "Install the app on each account to start tracking."}
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          title="Refresh"
          className="ml-2 shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="divide-y divide-border/50">
        {installations.map((account) => (
          <div key={account.login} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={account.avatarUrl}
                  alt={account.login}
                  className={`h-6 w-6 rounded-full shrink-0 ${account.locked ? "opacity-40 grayscale" : ""}`}
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted/40 flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                  {account.login.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${account.locked ? "text-muted-foreground/50" : ""}`}>{account.login}</p>
                <p className="text-[10px] text-muted-foreground">{account.type}</p>
              </div>
            </div>
            {account.locked ? (
              <button
                onClick={openUpgradeModal}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-blue/30 hover:text-blue transition-colors"
              >
                <Lock className="h-3 w-3" /> Upgrade
              </button>
            ) : account.installed ? (
              <span className="shrink-0 flex items-center gap-1 text-[11px] text-success font-medium">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : (
              <a
                href={account.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue/30 bg-blue/10 px-2.5 py-1 text-[11px] font-medium text-blue hover:bg-blue/20 transition-colors"
              >
                Install App
              </a>
            )}
          </div>
        ))}
      </div>

      {baseInstallUrl && (
        <div className="px-4 py-2.5 border-t border-border/50">
          <a
            href={baseInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <PlusCircle className="h-3 w-3" />
            Install on another organization
          </a>
        </div>
      )}
    </div>
  );
}
