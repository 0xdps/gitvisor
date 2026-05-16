import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { RegistryRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

const APP_SLUG_ENV = "GITHUB_APP_SLUG";

type GitHubAccount = { id: number; login: string; avatar_url: string; type?: string };

export function createInstallationsRouter(
  registry: RegistryRepository,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * POST /installations/finalize
   * Called after GitHub redirects back from a successful App installation.
   * Associates the installation with the currently authenticated user so the
   * normal repository sync flow can run immediately.
   */
  router.post("/finalize", async (c) => {
    const user = c.get("user");
    const githubToken = c.get("githubToken");
    const body = await c.req.json<{ installationId?: number }>();

    if (!body.installationId || Number.isNaN(body.installationId)) {
      return c.json({ ok: false, error: "Missing installationId" }, 400);
    }

    const installRes = await fetch("https://api.github.com/user/installations?per_page=100", {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!installRes.ok) {
      return c.json({ ok: false, error: "Failed to fetch installations" }, 502);
    }

    const installBody = (await installRes.json()) as {
      installations?: Array<{
        id: number;
        app_slug: string;
        suspended_at: string | null;
        account: {
          login?: string;
          name?: string;
          type?: string;
          slug?: string;
        } | null;
      }>;
    };

    const installation = (installBody.installations ?? []).find(
      (item) => item.id === body.installationId,
    );

    if (!installation) {
      return c.json({ ok: false, error: "Installation not accessible" }, 404);
    }

    const accountLogin =
      installation.account?.login ?? installation.account?.slug ?? installation.account?.name ?? "";

    await registry.upsertInstallation({
      id: crypto.randomUUID(),
      githubInstallationId: installation.id,
      userId: user.id,
      accountLogin,
      accountType: (installation.account?.type === "Organization"
        ? "Organization"
        : "User") as "User" | "Organization",
      appSlug: installation.app_slug,
      suspended: installation.suspended_at !== null,
      uninstalledAt: null,
    });

    return c.json({ ok: true, data: { installationId: installation.id } });
  });

  /**
   * GET /installations
   * Returns the user's personal account and all their GitHub orgs, each
   * annotated with whether the GitHub App is installed on that account.
   *
   * Org sources (merged, deduped by login):
   *   1. GraphQL viewer.organizations — ALL org memberships (public + private).
   *      Works correctly with GitHub App user access tokens (ghu_…), unlike the
   *      REST GET /user/orgs which silently returns [] for fine-grained tokens.
   *      Requires "Organization members: Read" on the GitHub App.
   *   2. GET /user/installations — installations the user can access. Used as
   *      a fallback and also to ensure installed status is accurate in real-time.
  *   3. GET /user/repos — best-effort supplement. We extract repository owner
  *      accounts where owner.type === "Organization" so orgs with accessible
  *      repos can still appear even when membership discovery is incomplete.
   *
   * Configure the GitHub App: Settings → Permissions & events → User
   * permissions → Organization members → Read.  After changing, users must
   * re-authorize ("Re-authorize" on github.com/settings/applications).
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const githubToken = c.get("githubToken");
    const appSlug = process.env[APP_SLUG_ENV] ?? "";

    // GraphQL query — viewer.organizations works with GitHub App user tokens;
    // the REST GET /user/orgs always returns [] for fine-grained (App) tokens.
    const graphqlQuery = `{
      viewer {
        organizations(first: 100) {
          nodes {
            login
            databaseId
            avatarUrl
          }
        }
      }
    }`;

    const [graphqlRes, registryInstalls, ghInstallsRes, ghReposRes] = await Promise.all([
      fetch("https://api.github.com/graphql", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ query: graphqlQuery }),
      }),
      registry.listInstallationsByUser(user.id),
      fetch("https://api.github.com/user/installations?per_page=100", {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
      fetch(
        "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member",
        {
          signal: AbortSignal.timeout(10_000),
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      ),
    ]);

    // Parse GraphQL org list. Falls back to empty array on error.
    type GQLOrg = { login: string; databaseId: number; avatarUrl: string };
    let gqlOrgs: GQLOrg[] = [];
    if (graphqlRes.ok) {
      const gqlBody = (await graphqlRes.json()) as {
        data?: { viewer?: { organizations?: { nodes?: GQLOrg[] } } };
        errors?: { message: string; type?: string }[];
      };
      if (gqlBody.errors?.length) {
        console.warn("[installations] GraphQL errors:", JSON.stringify(gqlBody.errors));
      }
      gqlOrgs = gqlBody.data?.viewer?.organizations?.nodes ?? [];
      console.log(`[installations] GraphQL returned ${gqlOrgs.length} orgs for user ${user.githubUsername}`, gqlOrgs.map((o) => o.login));
    } else {
      const errText = await graphqlRes.text().catch(() => "(unreadable)");
      console.warn(`[installations] GraphQL HTTP ${graphqlRes.status}:`, errText);
    }

    type GHInstallation = { account: GitHubAccount };
    const ghInstalls: GHInstallation[] = ghInstallsRes.ok
      ? (
          (await ghInstallsRes.json()) as {
            installations: GHInstallation[];
          }
        ).installations
      : [];

    type GHRepo = { owner?: GitHubAccount | null };
    const ghRepoOwners: GitHubAccount[] = ghReposRes.ok
      ? ((await ghReposRes.json()) as GHRepo[])
          .map((repo) => repo.owner)
          .filter(
            (owner): owner is GitHubAccount =>
              owner != null && owner.type === "Organization" && owner.login.length > 0,
          )
      : [];

    // Merge registry installs (fast, offline) with the real-time GitHub API
    // response so install status is always accurate regardless of webhooks.
    const installedLogins = new Set([
      ...registryInstalls.map((i) => i.accountLogin.toLowerCase()),
      ...ghInstalls.map((i) => i.account.login.toLowerCase()),
    ]);

    // Build the full org list. Primary: GraphQL (all memberships). Fallback /
    // supplement: installations from REST and organization owners inferred from
    // accessible repositories.
    const orgsByLogin = new Map<string, GitHubAccount>();
    for (const org of gqlOrgs) {
      orgsByLogin.set(org.login.toLowerCase(), {
        id: org.databaseId,
        login: org.login,
        avatar_url: org.avatarUrl,
        type: "Organization",
      });
    }
    for (const install of ghInstalls) {
      const acct = install.account;
      if (
        acct.type === "Organization" &&
        acct.login.toLowerCase() !== user.githubUsername.toLowerCase() &&
        !orgsByLogin.has(acct.login.toLowerCase())
      ) {
        orgsByLogin.set(acct.login.toLowerCase(), acct);
      }
    }
    for (const owner of ghRepoOwners) {
      if (
        owner.login.toLowerCase() !== user.githubUsername.toLowerCase() &&
        !orgsByLogin.has(owner.login.toLowerCase())
      ) {
        orgsByLogin.set(owner.login.toLowerCase(), owner);
      }
    }

    const accounts = [
      {
        githubId: Number(user.id),
        login: user.githubUsername,
        avatarUrl: user.avatarUrl,
        type: "User" as const,
        installed: installedLogins.has(user.githubUsername.toLowerCase()),
        // Install-only URL (no /permissions). The /permissions variant triggers
        // a new OAuth exchange that fails our state check when the user returns
        // (oauth_state cookie already consumed). Without /permissions, GitHub
        // redirects back with only installation_id + setup_action=install, which
        // finalizeInstallation handles correctly.
        installUrl: appSlug
          ? `https://github.com/apps/${appSlug}/installations/new?target_id=${user.id}&target_type=User`
          : null,
      },
      ...[...orgsByLogin.values()].map((org) => ({
        githubId: org.id,
        login: org.login,
        avatarUrl: org.avatar_url,
        type: "Organization" as const,
        installed: installedLogins.has(org.login.toLowerCase()),
        installUrl: appSlug
          ? `https://github.com/apps/${appSlug}/installations/new?target_id=${org.id}&target_type=Organization`
          : null,
      })),
    ];

    return c.json({ ok: true, data: accounts });
  });

  return router;
}
