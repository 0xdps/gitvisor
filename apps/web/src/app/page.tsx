import Link from "next/link";

function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2 8 6 12 14 4" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Workflow Runs",
    description: "Live status, duration and conclusions across every repository. Re-run or cancel jobs without leaving the dashboard.",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    ),
  },
  {
    title: "Secrets Management",
    description: "Inspect secret metadata and rotate repository secrets across your entire GitHub org. Raw values never leave GitHub.",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
      </svg>
    ),
  },
  {
    title: "Package Tracking",
    description: "Monitor GitHub Packages across npm, Docker, Maven, and more. Track versions and download counts in one view.",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h.008v.008H10v-.008Zm0-3h.008v.008H10v-.008ZM6.375 7.5h7.5" />
      </svg>
    ),
  },
  {
    title: "Audit Log",
    description: "Complete, tamper-evident audit trail of every action taken through Gitvisor — who did what, and when.",
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
] as const;

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals exploring Gitvisor.",
    features: ["3 repositories", "7-day run history", "Manual sync", "Public repos"],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/ month",
    description: "For developers who ship every day.",
    features: ["25 repositories", "90-day run history", "Webhook-driven sync", "Secrets management", "Private repos"],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/ month",
    description: "For engineering teams at scale.",
    features: ["Unlimited repositories", "365-day run history", "Webhook-driven sync", "Secrets management", "Priority support"],
    cta: "Start free trial",
    highlighted: false,
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/icon-trans.png" alt="" className="h-6 w-6" />
            <span>Gitvisor</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <a
              href="https://github.com/0xdps/gitvisor"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
          </nav>

          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-24 text-center">
          <a
            href="https://github.com/0xdps/gitvisor"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <GitHubIcon className="h-3.5 w-3.5" />
            Open-source core · MIT
          </a>

          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            GitHub visibility<br />
            <span className="text-muted-foreground">for developers who ship.</span>
          </h1>

          <p className="mb-10 max-w-xl text-lg text-muted-foreground">
            Monitor every workflow run, manage secrets, track packages, and debug CI/CD failures — all from a single clean dashboard.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started free
            </Link>
            <a
              href="https://github.com/0xdps/gitvisor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <GitHubIcon />
              View on GitHub
            </a>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────────── */}
        <section id="features" className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Everything your team needs</h2>
              <p className="mt-3 text-muted-foreground">
                GitHub is the source of truth. Gitvisor gives you the visibility layer.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────────────── */}
        <section id="pricing" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Start free. Upgrade when you need more.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-xl border p-6 ${
                    plan.highlighted
                      ? "border-foreground bg-primary text-primary-foreground shadow-lg"
                      : "border-border bg-card"
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-foreground px-3 py-0.5 text-xs font-semibold text-background">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold">{plan.price}</span>
                      <span className={`text-sm ${plan.highlighted ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {plan.period}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${plan.highlighted ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {plan.description}
                    </p>
                  </div>

                  <ul className="mb-8 flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5 text-sm">
                        <span className={plan.highlighted ? "text-primary-foreground" : "text-foreground"}>
                          <CheckIcon />
                        </span>
                        {feat}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={`rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/icon-trans.png" alt="" className="h-5 w-5 opacity-60" />
            <span>© {new Date().getFullYear()} Gitvisor</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/tos" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <a
              href="https://github.com/0xdps/gitvisor"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>

    </div>
  );
}
