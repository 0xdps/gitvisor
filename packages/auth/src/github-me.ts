import type { User } from "@gitvisor/shared";

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  created_at: string;
}

interface GitHubEmailEntry {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Fetch the authenticated user's profile from the GitHub API.
 * Falls back to /user/emails if the public profile has no email set.
 */
export async function fetchGitHubUser(accessToken: string): Promise<User> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    throw new Error(`GitHub /user failed: ${userRes.status}`);
  }
  const ghUser = (await userRes.json()) as GitHubUserResponse;

  let email = ghUser.email;

  // If the profile email is null/hidden, fetch the verified primary email
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as GitHubEmailEntry[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? null;
    }
  }

  if (!email) {
    throw new Error("Could not determine a verified email from GitHub");
  }

  return {
    id: "owner",
    email,
    name: ghUser.name,
    avatarUrl: ghUser.avatar_url,
    createdAt: ghUser.created_at,
  };
}
