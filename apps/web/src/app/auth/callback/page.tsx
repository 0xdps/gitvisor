"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { exchangeCode, finalizeInstallation } from "@/lib/auth-client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const rawInstallationId = searchParams.get("installation_id");
    const installationId = rawInstallationId ? Number(rawInstallationId) : undefined;
    const setupAction = searchParams.get("setup_action");

    if (!code || !state) {
      if (installationId !== undefined && setupAction === "install") {
        finalizeInstallation(installationId)
          .then(() => router.replace("/dashboard"))
          .catch(() => router.replace("/dashboard"));
        return;
      }

      router.replace("/login");
      return;
    }
    exchangeCode(code, state, installationId)
      .then(async (nextUrl) => {
        // When GitHub redirects back from the combined install+auth flow
        // (/installations/new/permissions), the response includes an installation_id.
        // The exchangeCode path doesn't call finalizeInstallation automatically, so
        // we trigger it here to register the installation and kick off the repo sync.
        if (installationId !== undefined) {
          await finalizeInstallation(installationId).catch(() => {});
        }
        if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
          window.location.assign(nextUrl);
          return;
        }
        router.replace(nextUrl);
      })
      .catch(() => router.replace("/login"));
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
