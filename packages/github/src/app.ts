import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

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
    // Use @octokit/rest as the base Octokit so all installation octokits get
    // .rest (endpoint methods) and .paginate out of the box.
    Octokit: Octokit as never,
  });
  return _app;
}

export function getGitHubApp(): App {
  if (!_app) throw new Error("GitHub App not initialized. Call createGitHubApp() first.");
  return _app;
}

/**
 * Returns an @octokit/rest Octokit authenticated as a specific installation.
 * .rest and .paginate are available. Token refresh is handled by @octokit/auth-app.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const octokit = await getGitHubApp().getInstallationOctokit(installationId);
  return octokit as unknown as Octokit;
}

