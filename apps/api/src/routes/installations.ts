import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { RegistryRepository } from "@gitvisor/db";
import type { AuthEnv } from "../middleware/auth.js";

const APP_SLUG_ENV = "GITHUB_APP_SLUG";

export function createInstallationsRouter(
  registry: RegistryRepository,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  router.use("*", requireAuth);

  /**
   * GET /installations
   * Returns the user's personal account and all their GitHub orgs, each
   * annotated with whether the GitHub App is installed on that account.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const githubToken = c.get("githubToken");
    const appSlug = process.env[APP_SLUG_ENV] ?? "";

    const [orgsRes, registryInstalls] = await Promise.all([
      fetch("https://api.github.com/user/orgs?per_page=100", {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
      registry.listInstallationsByUser(user.id),
    ]);

    const orgs: Array<{ id: number; login: string; avatar_url: string }> = orgsRes.ok
      ? ((await orgsRes.json()) as Array<{ id: number; login: string; avatar_url: string }>)
      : [];

    const installedLogins = new Set(
      registryInstalls.map((i) => i.accountLogin.toLowerCase()),
    );

    const accounts = [
      {
        githubId: Number(user.id),
        login: user.githubUsername,
        avatarUrl: user.avatarUrl,
        type: "User" as const,
        installed: installedLogins.has(user.githubUsername.toLowerCase()),
        installUrl: appSlug
          ? `https://github.com/apps/${appSlug}/installations/new/permissions?target_id=${user.id}&target_type=User`
          : null,
      },
      ...orgs.map((org) => ({
        githubId: org.id,
        login: org.login,
        avatarUrl: org.avatar_url,
        type: "Organization" as const,
        installed: installedLogins.has(org.login.toLowerCase()),
        installUrl: appSlug
          ? `https://github.com/apps/${appSlug}/installations/new/permissions?target_id=${org.id}&target_type=Organization`
          : null,
      })),
    ];

    return c.json({ ok: true, data: accounts });
  });

  return router;
}
