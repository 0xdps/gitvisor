"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Column,
  Content,
  Grid,
  Header,
  HeaderName,
  InlineLoading,
  InlineNotification,
} from "@carbon/react";
import { exchangeCode, finalizeInstallation } from "@/lib/auth-client";
import { LogoIcon } from "@/components/logo-icon";

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <Header aria-label="Gitvisor">
        <HeaderName href="/" prefix="" as={Link}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <LogoIcon size="xs" />
            Gitvisor
          </span>
        </HeaderName>
      </Header>
      <Content id="main">
        <Grid>
          <Column sm={4} md={5} lg={{ span: 8, offset: 4 }}>
            <LogoIcon size="xl" />
            {children}
          </Column>
        </Grid>
      </Content>
    </>
  );
}

function SigningIn({ description }: { description: string }) {
  return (
    <AuthFrame>
      <h1 className="cds--type-productive-heading-04" style={{ marginTop: "1rem" }}>
        Signing you in
      </h1>
      <p className="cds--type-body-01" style={{ marginTop: "0.5rem", maxWidth: "36rem" }}>
        GitHub sent you back. Gitvisor is finishing the sign-in on this page, then opens your dashboard.
      </p>
      <div style={{ marginTop: "2rem" }}>
        <InlineLoading description={description} status="active" />
      </div>
    </AuthFrame>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [description, setDescription] = useState("Checking GitHub’s response");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const rawInstallationId = searchParams.get("installation_id");
    const installationId = rawInstallationId ? Number(rawInstallationId) : undefined;
    const setupAction = searchParams.get("setup_action");

    if (!code || !state) {
      if (installationId !== undefined && setupAction === "install") {
        setDescription("Connecting your repositories");
        finalizeInstallation(installationId)
          .then(() => router.replace("/dashboard"))
          .catch(() => router.replace("/dashboard"));
        return;
      }

      router.replace("/login");
      return;
    }

    setDescription("Creating your session");
    exchangeCode(code, state, installationId)
      .then(async (nextUrl) => {
        // When GitHub redirects back from the combined install+auth flow
        // (/installations/new/permissions), the response includes an installation_id.
        // The exchangeCode path doesn't call finalizeInstallation automatically, so
        // we trigger it here to register the installation and kick off the repo sync.
        if (installationId !== undefined) {
          setDescription("Connecting your repositories");
          await finalizeInstallation(installationId).catch(() => {});
        }
        if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
          setDescription("Opening GitHub to install the app");
          window.location.assign(nextUrl);
          return;
        }
        setDescription("Opening your dashboard");
        router.replace(nextUrl);
      })
      .catch(() => setError("GitHub did not accept this sign-in. Start again from the login page."));
  }, [router, searchParams]);

  if (error) {
    return (
      <AuthFrame>
        <h1 className="cds--type-productive-heading-04" style={{ marginTop: "1rem" }}>
          Sign-in stopped
        </h1>
        <div style={{ marginTop: "1.5rem" }}>
          <InlineNotification kind="error" title="Could not finish signing in" subtitle={error} hideCloseButton lowContrast />
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <Button as={Link} href="/login">
            Back to sign in
          </Button>
        </div>
      </AuthFrame>
    );
  }

  return <SigningIn description={description} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<SigningIn description="Checking GitHub’s response" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
