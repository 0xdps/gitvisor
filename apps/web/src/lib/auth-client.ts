import type { User } from "@gitvisor/shared";
import { syncRepositories } from "@/lib/api-client";

// Client-side calls use the /api proxy (Next.js rewrites → API service).
// Server-side calls (Server Components) bypass the proxy and hit the API directly.
const API_URL =
  typeof window === "undefined"
    ? (process.env["API_INTERNAL_URL"] ?? "http://localhost:3002")
    : "/api";

/**
 * Fetch the GitHub OAuth URL from the API and redirect the browser there.
 * The API owns the redirect URI; the frontend just follows.
 */
export async function login(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/login`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to start login");
  const { data } = (await res.json()) as { data: { url: string } };
  window.location.href = data.url;
}

/**
 * Return the currently signed-in user, or null if not authenticated.
 * Reads the local session cookie — no external call from the API.
 * Pass `headers` when calling from a server context (SSR) so the incoming
 * request's Cookie is forwarded to the API.
 */
export async function me(headers?: HeadersInit): Promise<User | null> {
  const res = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
    headers: { ...headers },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");
  const { data } = (await res.json()) as { data: User };
  return data;
}

/**
 * Sign out: clears the session cookie on the server.
 */
export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

/**
 * Exchange a GitHub OAuth code for a session cookie.
 * The state must match the value set by the server in the oauth_state cookie
 * (CSRF protection — verified server-side).
 * Called from /auth/callback after GitHub redirects back.
 *
 * `installationId` is the GitHub App installation ID returned by GitHub when
 * the user completes the unified installation + OAuth flow.  It is forwarded
 * to the API so the backend can immediately kick off a repo sync for the
 * newly installed account/org rather than waiting for the webhook.
 */
export async function exchangeCode(
  code: string,
  state: string,
  installationId?: number,
): Promise<string> {
  const res = await fetch(`${API_URL}/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      code,
      state,
      ...(installationId !== undefined ? { installation_id: installationId } : {}),
    }),
  });
  if (!res.ok) throw new Error("OAuth exchange failed");
  const { data } = (await res.json()) as { data: { nextUrl?: string } };
  return data.nextUrl ?? "/dashboard";
}

export async function finalizeInstallation(installationId: number): Promise<void> {
  const res = await fetch(`${API_URL}/installations/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ installationId }),
  });

  if (!res.ok) throw new Error("Installation finalize failed");

  await syncRepositories(installationId);
}
