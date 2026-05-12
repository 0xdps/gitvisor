import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader } from "../components/public-header";
import { PublicFooter } from "../components/public-footer";

export const Route = createFileRoute("/tos")({
  component: TosPage,
});

function TosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective date: May 12, 2025 · Last updated: May 12, 2025
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. About Gitvisor</h2>
            <p className="text-muted-foreground">
              Gitvisor ("we", "us", "our") is a GitHub Actions management
              dashboard that lets you monitor workflow runs, manage repository
              secrets, and view CI/CD activity across your GitHub repositories.
              By accessing or using Gitvisor you agree to these Terms of Service.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must have a valid GitHub account and be at least 13 years old
              (or the minimum age required by law in your jurisdiction) to use
              Gitvisor. By signing in you confirm that you meet these requirements
              and that your use complies with any restrictions imposed by your
              employer or institution.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. GitHub App permissions</h2>
            <p className="mb-2 text-muted-foreground">
              The Gitvisor GitHub App requests the following permissions on
              repositories you explicitly select during installation:
            </p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Actions (read)</strong> — to list and
                display workflow runs and their logs metadata.
              </li>
              <li>
                <strong className="text-foreground">Secrets (read and write)</strong> — to list
                secret names, create new secrets, and update or delete existing
                ones on your behalf. We never read or store secret values.
              </li>
              <li>
                <strong className="text-foreground">Metadata (read)</strong> — required by
                GitHub for any App installation; used to read repository names
                and basic info.
              </li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              You can revoke the installation at any time from your GitHub
              account settings under Installed GitHub Apps.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Acceptable use</h2>
            <p className="mb-2 text-muted-foreground">You agree not to:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Attempt to access data belonging to other Gitvisor users.</li>
              <li>Use the service to automate abuse of GitHub's API or rate limits.</li>
              <li>Reverse-engineer, decompile, or attempt to extract our server-side source code.</li>
              <li>Use the service for any unlawful purpose or in violation of{" "}
                <a
                  href="https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  GitHub's Acceptable Use Policies
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Secret values</h2>
            <p className="text-muted-foreground">
              Gitvisor displays secret names and metadata only. We do not request,
              transmit, store, or have access to the encrypted values of your
              GitHub secrets. When you create or update a secret through
              Gitvisor's dashboard, the value is encrypted using GitHub's public
              key in your browser before being sent directly to the GitHub API.
              Gitvisor's servers never see the plaintext value.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Beta service</h2>
            <p className="text-muted-foreground">
              Gitvisor is currently in beta. The service is provided free of
              charge and "as is" without any guarantee of uptime, availability,
              data durability, or fitness for a particular purpose. Features may
              change, be removed, or be rate-limited at any time without prior
              notice.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Disclaimer of warranties</h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by law, Gitvisor is provided
              "as is" without warranties of any kind, either express or implied,
              including but not limited to warranties of merchantability, fitness
              for a particular purpose, or non-infringement.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Limitation of liability</h2>
            <p className="text-muted-foreground">
              We are not liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of
              Gitvisor — including missed deployments, failed builds, production
              outages, or data loss — even if we have been advised of the
              possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Open source</h2>
            <p className="text-muted-foreground">
              The core Gitvisor application is open source and available under
              the MIT License on{" "}
              <a
                href="https://github.com/0xdps/gitvisor"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                GitHub
              </a>
              . These terms apply to the hosted Gitvisor service, not to your
              own deployments of the open-source code.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Changes to these terms</h2>
            <p className="text-muted-foreground">
              We will notify registered users by email at least 14 days before
              making material changes to these terms. Continued use of the
              service after changes take effect constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Contact</h2>
            <p className="text-muted-foreground">
              Questions about these terms?{" "}
              <a
                href="mailto:legal@gitvisor.dev"
                className="underline underline-offset-2 hover:text-foreground"
              >
                legal@gitvisor.dev
              </a>
            </p>
          </section>
        </div>

        <div className="mt-14 flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
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
