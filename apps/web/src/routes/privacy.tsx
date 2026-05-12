import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "../components/public-header";
import { PublicFooter } from "../components/public-footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: May 12, 2025 · Last updated: May 12, 2025
          </p>
        </div>

        <div className="prose prose-zinc max-w-none space-y-10 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. What Gitvisor is</h2>
            <p className="text-muted-foreground">
              Gitvisor is a GitHub Actions management dashboard. We connect to
              your GitHub account via OAuth and a GitHub App installation to
              display workflow runs, secrets metadata, and related repository
              information in a single interface. This policy explains what data
              we collect, why we collect it, and how we handle it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Data we collect</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">GitHub account information</strong> — GitHub
                user ID, username (login), display name, email address, and
                avatar URL, obtained via GitHub OAuth at sign-in.
              </li>
              <li>
                <strong className="text-foreground">GitHub App installation data</strong> —
                Installation ID and the list of repositories you selected when
                installing the Gitvisor GitHub App.
              </li>
              <li>
                <strong className="text-foreground">Workflow run data</strong> — Run IDs, names,
                status and conclusion, branch names, commit SHAs, triggering
                actor, and timestamps for all workflow runs in your selected
                repositories.
              </li>
              <li>
                <strong className="text-foreground">Secret metadata</strong> — The names and
                last-updated timestamps of repository secrets. We never request,
                transmit, or store secret values.
              </li>
              <li>
                <strong className="text-foreground">Session data</strong> — An httpOnly, Secure
                session cookie used to maintain your authenticated session. No
                advertising identifiers or cross-site tracking.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. Data we do not collect</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Secret values — ever.</li>
              <li>Source code from your repositories.</li>
              <li>Payment or billing information (free during beta).</li>
              <li>Analytics fingerprints or advertising identifiers.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. How we use your data</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>To authenticate you and maintain your session.</li>
              <li>To display your GitHub Actions dashboard.</li>
              <li>To sync workflow run history and live updates via webhooks.</li>
              <li>To allow you to manage (list, create, update, delete) repository secrets through the dashboard.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Data storage</h2>
            <p className="text-muted-foreground">
              Your data is stored in an isolated, per-user SQLite database
              managed by MesaHub (our database infrastructure provider). Databases
              are logically separated — no user can access another user's data.
              Data is stored on servers in the European Union unless you are
              accessing a region-specific deployment.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Third-party processors</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">GitHub</strong> (GitHub, Inc.) — OAuth
                authentication and GitHub App API. Subject to{" "}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  GitHub's Privacy Statement
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">MesaHub</strong> — Database storage for
                per-user workflow and installation data.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              We do not sell or share your data with any other third parties for
              advertising or commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Data retention and deletion</h2>
            <p className="text-muted-foreground">
              You can delete your Gitvisor account and all associated data at any
              time from the account settings page. We delete all personal data
              within 30 days of account deletion. Session cookies expire after 7
              days of inactivity or upon sign-out.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Security</h2>
            <p className="text-muted-foreground">
              Session cookies are httpOnly, Secure, and SameSite=Lax. All
              communication with our API is over HTTPS. Per-user database
              isolation ensures that even in the event of a bug, one user cannot
              access another's data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Changes to this policy</h2>
            <p className="text-muted-foreground">
              We will notify registered users by email before making material
              changes to this privacy policy. The updated effective date will be
              shown at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Contact</h2>
            <p className="text-muted-foreground">
              Questions or concerns about this policy?{" "}
              <a
                href="mailto:privacy@gitvisor.dev"
                className="underline underline-offset-2 hover:text-foreground"
              >
                privacy@gitvisor.dev
              </a>
            </p>
          </section>
        </div>

        <div className="mt-14 flex gap-4 text-sm text-muted-foreground">
          <Link to="/tos" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/" className="underline underline-offset-2 hover:text-foreground">
            Back to home
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
