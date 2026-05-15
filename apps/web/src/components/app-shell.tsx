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
  GitFork,
  KeyRound,
  LayoutDashboard,
  LogOut,
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
import { getWorkflowRuns } from "../lib/api-client";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { label: "Dashboard",    to: "/dashboard",    icon: LayoutDashboard },
  { label: "Repositories", to: "/repositories", icon: GitFork },
  { label: "Workflows",    to: "/workflows",    icon: Activity },
  { label: "Releases",     to: "/releases",     icon: Tag },
  { label: "Analytics",    to: "/analytics",    icon: BarChart2 },
  { label: "Secrets",      to: "/secrets",      icon: KeyRound },
  { label: "Packages",     to: "/packages",     icon: Package },
  { label: "Audit Log",    to: "/audit-log",    icon: ScrollText },
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

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
    retry: false,
  });

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
      <div className="h-screen overflow-hidden flex bg-background">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside
          className={`${
            expanded ? "w-52" : "w-14"
          } transition-[width] duration-200 ease-in-out border-r border-border flex flex-col shrink-0 bg-sidebar py-3 overflow-hidden`}
        >
          {/* Logo */}
          <div className={`flex items-center ${expanded ? "gap-2.5 px-3 mb-5" : "justify-center mb-5"}`}>
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5 transition-colors shrink-0"
            >
              <LogoIcon size="sm" />
            </Link>
            {expanded && (
              <span className="text-sm font-semibold text-foreground truncate">Gitvisor</span>
            )}
          </div>

          {/* Nav */}
          <nav className={`flex flex-col flex-1 gap-0.5 ${expanded ? "px-2" : "items-center px-0"}`}>
            {navItems.map(({ label, to, icon: Icon }) => {
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
                  className={`relative flex h-9 items-center rounded-lg transition-colors ${
                    expanded ? "w-full gap-2.5 px-3" : "w-9 justify-center"
                  } ${
                    isActive
                      ? "bg-blue/15 text-blue"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {expanded && (
                    <span className="text-sm font-medium truncate flex-1">{label}</span>
                  )}
                  {showBadge && (
                    <span
                      className={`${
                        expanded
                          ? "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-0.5 text-[9px] font-black text-warning-foreground"
                          : "absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-warning text-[7px] font-black text-warning-foreground leading-none"
                      }`}
                    >
                      {liveCount > 9 ? "9+" : liveCount}
                    </span>
                  )}
                </Link>
              );

              return expanded ? (
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
          <div className={`flex ${expanded ? "justify-end px-2" : "justify-center"} mb-1`}>
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
          <div className={`${expanded ? "px-2" : "flex justify-center"} mt-1`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {expanded ? (
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
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>

      </div>
    </TooltipProvider>
  );
}

