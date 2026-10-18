"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoIcon } from "./logo-icon";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart2,
  Building2,
  ChevronDown,
  ExternalLink,
  Flame,
  GitFork,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PanelLeft,
  PanelLeftClose,
  ScrollText,
  Tag,
  User,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@gitvisor/ui";
import { me, logout as authLogout } from "../lib/auth-client";
import { getInstallations, getWorkflowRuns } from "../lib/api-client";
import { useAccount } from "../lib/account-context";
import { useUpgradeModal } from "./upgrade-modal";

interface AppShellProps {
  children: ReactNode;
}

type NavItem = { label: string; to: string; icon: React.ElementType } | null;

const navItems: NavItem[] = [
  { label: "Ops Center",   to: "/dashboard",    icon: Flame },
  null,
  { label: "Workflows",    to: "/workflows",    icon: Activity },
  { label: "Releases",     to: "/releases",     icon: Tag },
  { label: "Packages",     to: "/packages",     icon: Package },
  null,
  { label: "Repositories", to: "/repositories", icon: GitFork },
  { label: "Secrets",      to: "/secrets",      icon: KeyRound },
  null,
  { label: "Analytics",    to: "/analytics",    icon: BarChart2 },
  { label: "Audit Log",    to: "/audit-log",    icon: ScrollText },
  { label: "Feedback",     to: "/feedback",     icon: MessageSquare },
];

function getInitials(name: string | null | undefined, email: string | undefined) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = expanded || mobileOpen;

  // Init from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setExpanded(localStorage.getItem("sidebar-expanded") === "true");
  }, []);

  function toggleSidebar() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-expanded", String(next));
      return next;
    });
  }

  const { selected: selectedAccount, select: selectAccount } = useAccount();
  const { openUpgradeModal } = useUpgradeModal();

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: installations } = useQuery({
    queryKey: ["installations"],
    queryFn: getInstallations,
    staleTime: 60_000,
    retry: false,
  });

  const installedAccounts = installations?.filter((a) => a.installed) ?? [];
  const uninstalledAccounts = installations?.filter((a) => !a.installed && (a.installUrl || a.locked)) ?? [];

  // If the user's plan was downgraded and the selected org is now locked,
  // clear the stale localStorage selection so locked data is never shown.
  useEffect(() => {
    if (!selectedAccount || !installations) return;
    const match = installations.find(
      (a) => a.login.toLowerCase() === selectedAccount.login.toLowerCase(),
    );
    if (match?.locked) {
      selectAccount(null);
    }
  }, [installations, selectedAccount, selectAccount]);

  const { data: liveRuns } = useQuery({
    queryKey: ["workflows", "live"],
    queryFn: () => getWorkflowRuns({ status: "in_progress", perPage: 1 }),
    staleTime: 15_000,
    retry: false,
  });

  const liveCount = liveRuns?.total ?? 0;

  function handleLogout() {
    void authLogout().then(() => {
      window.location.href = "/login";
    });
  }

  const initials = getInitials(user?.name, user?.email);

  return (
    <TooltipProvider delayDuration={400}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="flex h-screen overflow-hidden bg-background">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-40 w-60 transition-transform duration-200 md:static md:translate-x-0 ${
            expanded ? "md:w-52" : "md:w-14"
          } flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar py-3`}
        >
          {/* Logo */}
          <div className={`mb-3 flex items-center ${labels ? "gap-2.5 px-3" : "justify-center"}`}>
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5 transition-colors shrink-0"
            >
              <LogoIcon size="sm" />
            </Link>
            {labels && (
              <span className="truncate text-sm font-semibold text-foreground">Gitvisor</span>
            )}
          </div>

          {/* Account switcher */}
          <div className={`${labels ? "mb-3 px-2" : "mb-3 flex justify-center"}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {labels ? (
                  <button className="w-full flex items-center gap-2 rounded-lg border border-border/60 bg-white/3 px-2 py-1.5 hover:bg-white/6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {selectedAccount?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedAccount.avatarUrl} alt={selectedAccount.login} className="h-5 w-5 rounded-full shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-blue/20 flex items-center justify-center shrink-0">
                        {selectedAccount ? (
                          <Building2 className="h-3 w-3 text-blue" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <span className="text-xs font-medium truncate flex-1 text-left text-foreground/80">
                      {selectedAccount?.login ?? "All accounts"}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-white/3 hover:bg-white/6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {selectedAccount?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedAccount.avatarUrl} alt={selectedAccount.login} className="h-5 w-5 rounded-full" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className="text-xs">
                      {selectedAccount?.login ?? "All accounts"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-52 bg-card border-border">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold py-1.5">
                  Switch account
                </DropdownMenuLabel>
                {/* "All accounts" option */}
                <DropdownMenuItem
                  onClick={() => selectAccount(null)}
                  className={`flex items-center gap-2 text-xs cursor-pointer ${!selectedAccount ? "text-blue font-medium" : ""}`}
                >
                  <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  All accounts
                  {!selectedAccount && <span className="ml-auto text-blue">✓</span>}
                </DropdownMenuItem>
                {/* Installed accounts */}
                {installedAccounts.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {installedAccounts.map((acct) =>
                      acct.locked ? (
                        <DropdownMenuItem
                          key={acct.login}
                          onClick={openUpgradeModal}
                          className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground/60"
                        >
                          {acct.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={acct.avatarUrl} alt={acct.login} className="h-5 w-5 rounded-full shrink-0 opacity-40 grayscale" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                              <Building2 className="h-3 w-3 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="truncate flex-1 line-through">{acct.login}</span>
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          key={acct.login}
                          onClick={() => selectAccount(acct)}
                          className={`flex items-center gap-2 text-xs cursor-pointer ${selectedAccount?.login === acct.login ? "text-blue font-medium" : ""}`}
                        >
                          {acct.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={acct.avatarUrl} alt={acct.login} className="h-5 w-5 rounded-full shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="truncate flex-1">{acct.login}</span>
                          {selectedAccount?.login === acct.login && <span className="ml-auto text-blue">✓</span>}
                        </DropdownMenuItem>
                      ),
                    )}
                  </>
                )}
                {/* Uninstalled accounts (install prompts) */}
                {uninstalledAccounts.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold py-1">
                      Not installed
                    </DropdownMenuLabel>
                    {uninstalledAccounts.map((acct) =>
                      acct.locked ? (
                        <DropdownMenuItem
                          key={acct.login}
                          onClick={openUpgradeModal}
                          className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground/60"
                        >
                          {acct.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={acct.avatarUrl} alt={acct.login} className="h-5 w-5 rounded-full shrink-0 opacity-40 grayscale" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                              <Building2 className="h-3 w-3 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="truncate flex-1 line-through">{acct.login}</span>
                          <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={acct.login} asChild>
                          <a
                            href={acct.installUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            {acct.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={acct.avatarUrl} alt={acct.login} className="h-5 w-5 rounded-full shrink-0 opacity-60" />
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                                <Building2 className="h-3 w-3 text-muted-foreground/50" />
                              </div>
                            )}
                            <span className="truncate flex-1">{acct.login}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </a>
                        </DropdownMenuItem>
                      ),
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nav */}
          <nav className={`flex flex-1 flex-col gap-0.5 ${labels ? "px-2" : "items-center px-0"}`}>
            {navItems.map((item, idx) => {
              // Divider
              if (item === null) {
                return (
                  <div
                    key={`divider-${idx}`}
                    className={`my-1 shrink-0 border-t border-border/50 ${labels ? "mx-1" : "w-5"}`}
                  />
                );
              }

              const { label, to, icon: Icon } = item;
              const isActive =
                pathname === to ||
                pathname.startsWith(to + "/") ||
                pathname.startsWith(to + "?");
              const showBadge = to === "/workflows" && liveCount > 0;

              const linkEl = (
                <Link
                  key={to}
                  href={to}
                  aria-label={label}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex h-9 items-center rounded-lg transition-colors ${
                    labels ? "w-full gap-2.5 px-3" : "w-9 justify-center"
                  } ${
                    isActive
                      ? "bg-blue/15 text-blue"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {labels && (
                    <span className="flex-1 truncate text-sm font-medium">{label}</span>
                  )}
                  {showBadge && (
                    <span
                      className={`${
                        labels
                          ? "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-0.5 text-[9px] font-black text-warning-foreground"
                          : "absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-warning text-[7px] font-black text-warning-foreground leading-none"
                      }`}
                    >
                      {liveCount > 9 ? "9+" : liveCount}
                    </span>
                  )}
                </Link>
              );

              return labels ? (
                linkEl
              ) : (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className="text-xs font-medium">
                    {label}{showBadge ? ` (${liveCount} live)` : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse/expand toggle */}
          <div className={`mb-1 hidden md:flex ${expanded ? "justify-end px-2" : "justify-center"}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5 transition-colors"
                  aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {expanded ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="text-xs">
                {expanded ? "Collapse" : "Expand"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* User avatar */}
          <div className={`${labels ? "px-2" : "flex justify-center"} mt-1`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {labels ? (
                  <button className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                      <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? ""} />
                      <AvatarFallback className="text-[9px] bg-blue/10 text-blue">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-medium truncate leading-tight">{user?.name ?? user?.githubUsername ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight">
                        {user?.githubUsername ? `@${user.githubUsername}` : user?.email}
                      </p>
                    </div>
                  </button>
                ) : (
                  <button className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                    <Avatar className="h-8 w-8 ring-1 ring-border hover:ring-foreground/30 transition-all cursor-pointer">
                      <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? ""} />
                      <AvatarFallback className="text-[10px] bg-blue/10 text-blue">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-56 bg-card border-border">
                <DropdownMenuLabel className="font-normal py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user?.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs bg-blue/10 text-blue">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user?.name ?? user?.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.githubUsername ? `@${user.githubUsername}` : user?.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <LogoIcon size="sm" />
            <span className="text-sm font-semibold">Gitvisor</span>
          </header>
          <main id="main" className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </div>

      </div>
    </TooltipProvider>
  );
}

