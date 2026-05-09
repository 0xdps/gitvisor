import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Redirect root to dashboard; auth guard in _auth layout handles unauthenticated users
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
