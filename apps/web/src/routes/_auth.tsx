import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { me } from "../lib/auth-client";
import { AppShell } from "../components/app-shell";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const user = await me();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
