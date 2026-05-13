"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, me } from "@/lib/auth-client";

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    me().then((user) => {
      if (user) router.replace("/dashboard");
    });
  }, [router]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await login();
    } catch {
      setError("Failed to start login. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <img src="/icon-trans.png" alt="Gitvisor" className="h-16 w-16" />

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gitvisor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            GitHub Actions visibility for developers who ship.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="inline-flex items-center gap-2.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <GitHubIcon />
          {loading ? "Redirecting…" : "Sign in with GitHub"}
        </button>
      </div>
    </div>
  );
}
