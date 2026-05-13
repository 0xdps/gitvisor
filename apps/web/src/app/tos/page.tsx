import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Gitvisor",
};

const LAST_UPDATED = "June 1, 2025";

export default function TermsOfServicePage() {
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
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mb-12 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm prose-zinc max-w-none space-y-10">

          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Gitvisor ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all visitors, users, and others who access the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">2. Account Terms</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>You must authenticate via your GitHub account. You are responsible for maintaining the security of your GitHub credentials.</li>
              <li>You must be a human. Accounts registered by bots or automated methods are not permitted unless explicitly authorised by Gitvisor.</li>
              <li>You are responsible for all content posted and activity that occurs under your account.</li>
              <li>One person or legal entity may not maintain more than one free account.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">3. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li>Attempt to probe, scan, or test the vulnerability of any system or network connected to the Service.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Attempt to gain unauthorised access to the Service or its related systems.</li>
              <li>Abuse or exploit the Service in a manner that causes harm to other users.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. Subscriptions and Billing</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is offered under multiple plan tiers including a free plan and paid plans (Pro and Team). Paid subscriptions are billed monthly or annually as selected at checkout. All fees are exclusive of applicable taxes.
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>You may cancel your paid subscription at any time; your plan will remain active until the end of the current billing period.</li>
              <li>Gitvisor reserves the right to change pricing at any time with at least 30 days' notice provided to existing subscribers.</li>
              <li>Refunds are handled on a case-by-case basis at the discretion of Gitvisor.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">5. Data and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-foreground underline underline-offset-4 hover:opacity-70">Privacy Policy</Link>. By using the Service you consent to the collection and use of data as described therein. Gitvisor does not store the raw values of your GitHub secrets — only metadata (names and last-updated timestamps).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The core of Gitvisor is released as open-source software under the MIT License and is available at{" "}
              <a href="https://github.com/0xdps/gitvisor" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:opacity-70">
                github.com/0xdps/gitvisor
              </a>. The Gitvisor name, logo, and brand marks are the property of Gitvisor and may not be used without prior written permission.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">7. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gitvisor may terminate or suspend your access immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease. You may also delete your account and associated data at any time from your account settings.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, Gitvisor shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenues, data, or goodwill arising from your use of the Service. The Service is provided "as is" without warranties of any kind, either express or implied.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">9. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved through binding arbitration or in courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">10. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gitvisor reserves the right to modify these Terms at any time. Material changes will be communicated via email or a prominent notice in the Service. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms, please open an issue on{" "}
              <a href="https://github.com/0xdps/gitvisor" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:opacity-70">
                GitHub
              </a>{" "}
              or reach out via the repository discussions.
            </p>
          </section>

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">← Back to home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy →</Link>
        </div>
      </footer>

    </div>
  );
}
