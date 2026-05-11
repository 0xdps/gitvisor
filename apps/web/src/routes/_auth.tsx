import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { me } from "../lib/auth-client";
import { AppShell } from "../components/app-shell";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: me,
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    throw redirect({ to: "/login" });
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
