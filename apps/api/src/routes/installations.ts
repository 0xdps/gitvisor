import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { RegistryRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

const APP_SLUG_ENV = "GITHUB_APP_SLUG";

type GitHubAccount = { id: number; login: string; avatar_url: string; type?: string };

// Core only supports personal user-account installations.
// Organization support is available in the cloud edition.

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

    if (installation.account?.type === "Organization") {
      return c.json(
        {
          ok: false,
          error:
            "Organization installations are not supported in this edition. Use the cloud edition for organization support.",
        },
        400,
      );
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
   * Returns the user's personal GitHub account annotated with whether the
   * GitHub App is installed.
   *
   * Core only supports personal user-account installations.
   * Organization support is available in the cloud edition.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const githubToken = c.get("githubToken");
    const appSlug = process.env[APP_SLUG_ENV] ?? "";

    const [registryInstalls, ghInstallsRes] = await Promise.all([
      registry.listInstallationsByUser(user.id),
      fetch("https://api.github.com/user/installations?per_page=100", {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
    ]);

    type GHInstallation = { id: number; account: GitHubAccount };
    const ghInstalls: GHInstallation[] = ghInstallsRes.ok
      ? ((await ghInstallsRes.json()) as { installations: GHInstallation[] }).installations
      : [];

    // Only count user-account installs as "installed" — ignore org installs in core.
    const userInstalledLogins = new Set([
      ...registryInstalls
        .filter((i) => i.accountType === "User")
        .map((i) => i.accountLogin.toLowerCase()),
      ...ghInstalls
        .filter((i) => i.account.type !== "Organization")
        .map((i) => i.account.login.toLowerCase()),
    ]);

    const accounts = [
      {
        githubId: Number(user.id),
        login: user.githubUsername,
        avatarUrl: user.avatarUrl,
        type: "User" as const,
        installed: userInstalledLogins.has(user.githubUsername.toLowerCase()),
        installUrl: appSlug
          ? `https://github.com/apps/${appSlug}/installations/new?target_id=${user.id}&target_type=User`
          : null,
      },
    ];

    return c.json({ ok: true, data: accounts });
  });

  return router;
}
