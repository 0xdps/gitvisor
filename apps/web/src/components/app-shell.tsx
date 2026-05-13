"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronsUpDown,
  GitFork,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
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
} from "@gitvisor/ui";
import { me, logout as authLogout } from "../lib/auth-client";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { label: "Dashboard",    to: "/dashboard",    icon: LayoutDashboard },
  { label: "Repositories", to: "/repositories", icon: GitFork },
  { label: "Workflows",    to: "/workflows",    icon: Activity },
  { label: "Secrets",      to: "/secrets",      icon: KeyRound },
  { label: "Packages",     to: "/packages",     icon: Package },
  { label: "Audit Log",   to: "/audit-log",    icon: ScrollText },
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
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 60_000,
    retry: false,
  });

  function handleLogout() {
    void authLogout().then(() => {
      window.location.href = "/login";
    });
  }

  const initials = getInitials(user?.name, user?.email);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/icon-trans.png" alt="Gitvisor" className="h-6 w-6" />
            <span className="font-bold text-sm tracking-tight">Gitvisor</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              href={to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User profile */}
        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors outline-none">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? user?.email ?? ""} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium leading-tight truncate">
                    {user?.name ?? user?.email ?? "…"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight truncate">
                    {user?.email ?? ""}
                  </p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <DropdownMenuLabel className="font-normal py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name ?? user?.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

