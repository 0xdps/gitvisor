"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Activity,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle,
  Terminal,
  RefreshCw,
} from "lucide-react";
import { PublicHeader } from "../components/public-header";
import { PublicFooter } from "../components/public-footer";
import { me } from "@/lib/auth-client";

const features = [
  {
    icon: Activity,
    title: "Workflow visibility",
    description:
      "See every GitHub Actions run across all your repositories in a single feed. Status, duration, branch, actor — all at a glance.",
  },
  {
    icon: Lock,
    title: "Secrets management",
    description:
      "List, audit, and update repository secrets without leaving your dashboard. Values are encrypted client-side and never stored.",
  },
  {
    icon: Zap,
    title: "Real-time sync",
    description:
      "Webhooks keep your data fresh instantly. Every workflow run and push event updates your dashboard within seconds.",
  },
  {
    icon: RefreshCw,
    title: "One-click rerun",
    description:
      "Failed a workflow? Rerun it directly from the dashboard without switching to GitHub. Cancel in-progress runs too.",
  },
  {
    icon: Terminal,
    title: "Historical data",
    description:
      "Full workflow run history synced on GitHub App install. Query, filter, and track trends over time.",
  },
  {
    icon: GitBranch,
    title: "Per-repo drill-down",
    description:
      "Click into any repository for a detailed view of its workflow runs, grouped by workflow name and branch.",
  },
];

const steps = [
  { label: "Sign in with GitHub", detail: "OAuth — no password required." },
  {
    label: "Install the GitHub App",
    detail: "Select the repos you want to monitor.",
  },
  {
    label: "Your data syncs automatically",
    detail: "Historical runs load immediately; live updates via webhooks.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    me().then((user) => {
      if (user) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-foreground py-24 md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Now in beta
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
            GitHub Actions visibility,{" "}
            <span className="text-white/60">simplified.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
            Monitor every workflow run, manage secrets, and debug CI/CD failures
            — all in one clean dashboard. Install in 60 seconds.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/0xdps/gitvisor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/20 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <GitBranch className="h-4 w-4" />
              View source
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="bg-background py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to understand your CI/CD
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for developers who want operational clarity without the
              GitHub tab overload.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="bg-muted/40 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Up and running in minutes
            </h2>
          </div>

          <ol className="space-y-6">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────── */}
      <section className="bg-foreground py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ready to stop guessing why your builds fail?
          </h2>
          <p className="mt-4 text-white/60">
            Free during beta. No credit card required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-white/60">
            {[
              "No credit card required",
              "GitHub OAuth — no password",
              "Open source",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" />
                {item}
              </span>
            ))}
          </div>
          <Link
            href="/login"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-white px-8 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
