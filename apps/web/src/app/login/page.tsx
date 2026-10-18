"use client";

import Link from "next/link";
import Script from "next/script";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoGithub } from "@carbon/icons-react";
import { Button, Column, Content, Grid, Header, HeaderName, InlineNotification, Tile } from "@carbon/react";
import { finalizeInstallation, login, me } from "@/lib/auth-client";
import { LogoIcon } from "@/components/logo-icon";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Cloudflare Turnstile site key — only set in cloud deployments.
  // Self-hosted deployments leave this unset and the widget is not shown.
  const siteKey = process.env.NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY ?? null;

  useEffect(() => {
    const rawInstallationId = searchParams.get("installation_id");
    const installationId = rawInstallationId ? Number(rawInstallationId) : undefined;
    const setupAction = searchParams.get("setup_action");

    void me()
      .then((user) => {
        if (user) {
          if (installationId !== undefined && setupAction === "install") {
            void finalizeInstallation(installationId)
              .catch(() => {
                // Fall through to the dashboard even if the post-install sync
                // kickoff fails; the user is already authenticated.
              })
              .finally(() => router.replace("/dashboard"));
            return;
          }

          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // Stay on the login page if the session is missing or invalid.
      });
  }, [router, searchParams]);

  // Register the Turnstile success / expiry callbacks on the window so the
  // implicit-render widget can invoke them.
  useEffect(() => {
    if (!siteKey) return;
    (window as unknown as Record<string, unknown>)["onTurnstileSuccess"] = (token: string) => {
      setTurnstileToken(token);
    };
    (window as unknown as Record<string, unknown>)["onTurnstileExpired"] = () => {
      setTurnstileToken(null);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>)["onTurnstileSuccess"];
      delete (window as unknown as Record<string, unknown>)["onTurnstileExpired"];
    };
  }, [siteKey]);

  async function handleLogin() {
    // If Turnstile is configured and the challenge is not yet solved, wait.
    if (siteKey && !turnstileToken) {
      setError("Please complete the security check below.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(turnstileToken ?? undefined);
    } catch {
      setError("Failed to start login. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      )}
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
          <Column sm={4} md={4} lg={{ span: 6, offset: 5 }}>
            <LogoIcon size="xl" />
            <h1 className="cds--type-productive-heading-04" style={{ marginTop: "1rem" }}>
              Sign in to the board
            </h1>
            <p className="cds--type-body-01" style={{ marginTop: "0.5rem" }}>
              GitHub remains the source of truth. Gitvisor reads operational metadata.
            </p>
            <Tile style={{ marginTop: "2rem" }}>
              {error ? (
                <InlineNotification
                  kind="error"
                  title="Sign-in failed"
                  subtitle={error}
                  hideCloseButton
                  lowContrast
                />
              ) : null}
              {siteKey && (
                <div
                  ref={turnstileRef}
                  className="cf-turnstile"
                  data-sitekey={siteKey}
                  data-callback="onTurnstileSuccess"
                  data-expired-callback="onTurnstileExpired"
                  data-theme="dark"
                  style={{ marginTop: error ? "1rem" : undefined }}
                />
              )}
              <div style={{ marginTop: "1rem" }}>
                <Button renderIcon={LogoGithub} disabled={loading} onClick={handleLogin}>
                  {loading ? "Redirecting…" : "Continue with GitHub"}
                </Button>
              </div>
              {process.env.NEXT_PUBLIC_SHOW_LEGAL_LINKS === "true" && (
                <p className="cds--helper-text" style={{ marginTop: "1rem" }}>
                  By continuing, you agree to our <a href="/tos">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
                </p>
              )}
            </Tile>
          </Column>
        </Grid>
      </Content>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={null}
    >
      <LoginContent />
    </Suspense>
  );
}
