import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@nube-auth/react";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Repositories", to: "/repositories" },
  { label: "Workflows", to: "/workflows" },
  { label: "Secrets", to: "/secrets" },
  { label: "Packages", to: "/packages" },
];

export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r flex flex-col shrink-0">
        <div className="h-14 flex items-center px-4 border-b">
          <span className="font-bold text-sm tracking-tight">GitVisor</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-4 flex items-center gap-3">
          {user?.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.name ?? user.email}
              className="w-7 h-7 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name ?? user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
