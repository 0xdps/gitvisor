import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@nube-auth/react";
import { AppShell } from "../components/app-shell";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    // Server-side auth check placeholder
    // Client-side guard is handled in the component below
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    throw redirect({ to: "/login" });
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
