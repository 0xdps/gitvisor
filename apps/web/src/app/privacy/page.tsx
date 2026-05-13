import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Gitvisor",
};

const LAST_UPDATED = "June 1, 2025";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground hover:opacity-80">
            <img src="/icon-trans.png" alt="" className="h-5 w-5" />
            Gitvisor
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in →
          </Link>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-12 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm prose-zinc max-w-none space-y-10">

          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gitvisor ("we", "our", "us") is committed to protecting your privacy. This policy explains what data we collect when you use Gitvisor, how we use it, and the choices you have. Gitvisor is a GitHub Actions dashboard — we access your GitHub data on your behalf to display it within the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">2. Data We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect only the data necessary to operate the Service:
            </p>

            <h3 className="mb-2 font-medium">From GitHub OAuth</h3>
            <ul className="mb-4 space-y-2 text-muted-foreground">
              <li>GitHub username, display name, and email address (if public)</li>
              <li>GitHub user ID and avatar URL</li>
              <li>GitHub App installation ID linking your account to your organisations or personal repos</li>
            </ul>

            <h3 className="mb-2 font-medium">From GitHub via the App Installation</h3>
            <ul className="mb-4 space-y-2 text-muted-foreground">
              <li>Repository metadata (names, IDs, visibility)</li>
              <li>Workflow run records (status, conclusion, timestamps, duration)</li>
              <li>Secret metadata (names and last-updated timestamps — <strong className="text-foreground">raw values are never retrieved or stored</strong>)</li>
              <li>GitHub Package metadata (names, versions, ecosystems, download counts)</li>
            </ul>

            <h3 className="mb-2 font-medium">Usage Data</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>Session tokens stored in HTTP-only cookies for authentication</li>
              <li>Basic server logs (IP address, timestamp, request path) retained for up to 30 days for security purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">3. How We Use Your Data</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>To authenticate your GitHub identity and maintain your session</li>
              <li>To display your GitHub workflow runs, secrets, and package data within the dashboard</li>
              <li>To process subscription billing (billing is handled by a third-party processor)</li>
              <li>To send transactional emails (e.g. billing receipts, account alerts) — no marketing without explicit opt-in</li>
              <li>To detect and prevent abuse, fraud, and security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. Third-Party Services</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">GitHub</strong> — All repository, workflow, secret, and package data is sourced via the GitHub API. Your use of Gitvisor is subject to{" "}
                <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:opacity-70">
                  GitHub's Privacy Statement
                </a>.
              </li>
              <li>
                <strong className="text-foreground">Infrastructure</strong> — The Service runs on cloud infrastructure. Data is stored in SQLite databases per-user and in a shared metadata registry. Storage is encrypted at rest.
              </li>
              <li>
                <strong className="text-foreground">Billing</strong> — Paid plan billing is processed by a third-party payment provider. We do not store full payment card details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">5. Data Retention</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>Workflow run history is retained according to your plan tier (7 days Free, 90 days Pro, 365 days Team).</li>
              <li>Your account data is retained for as long as your account is active.</li>
              <li>Upon account deletion, your personal data and repository data are deleted within 30 days.</li>
              <li>Anonymised, aggregated usage statistics may be retained indefinitely.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your jurisdiction you may have the right to access, correct, or delete your personal data. To exercise these rights, delete your account from account settings or contact us via GitHub. We will respond to verifiable requests within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">7. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including HTTPS-only transport, encrypted storage, and least-privilege access controls. GitHub OAuth tokens are stored securely and used only to serve your dashboard. We conduct periodic security reviews and will notify you of any material data breach as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gitvisor uses a single HTTP-only, secure session cookie to maintain your login state. We do not use third-party advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting a notice in the Service or via email. Continued use after changes take effect constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions or data requests, please open an issue or discussion on{" "}
              <a href="https://github.com/0xdps/gitvisor" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:opacity-70">
                GitHub
              </a>.
            </p>
          </section>

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
          <Link href="/tos" className="hover:text-foreground transition-colors">Terms of Service →</Link>
        </div>
      </footer>

    </div>
  );
}
