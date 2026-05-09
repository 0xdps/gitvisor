import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { nubeAuthClient } from "../../lib/auth-client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const codeVerifier = sessionStorage.getItem("pkce_verifier");

    if (!code || !codeVerifier) {
      navigate({ to: "/login" });
      return;
    }

    sessionStorage.removeItem("pkce_verifier");

    nubeAuthClient.app
      .exchangeCode(code, { codeVerifier })
      .then(() => {
        navigate({ to: "/dashboard" });
      })
      .catch(() => {
        navigate({ to: "/login" });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
}
