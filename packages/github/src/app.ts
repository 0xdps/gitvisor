import { App } from "@octokit/app";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
}

let _app: App | null = null;

export function createGitHubApp(config: GitHubAppConfig): App {
  _app = new App({
    appId: config.appId,
    privateKey: config.privateKey,
    webhooks: { secret: config.webhookSecret },
    oauth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    },
  });
  return _app;
}

export function getGitHubApp(): App {
  if (!_app) throw new Error("GitHub App not initialized. Call createGitHubApp() first.");
  return _app;
}

/**
 * Returns an Octokit instance authenticated as a specific installation.
 * Tokens are automatically refreshed by @octokit/app.
 */
export async function getInstallationOctokit(
  installationId: number,
): Promise<Awaited<ReturnType<App["getInstallationOctokit"]>>> {
  return getGitHubApp().getInstallationOctokit(installationId);
}
