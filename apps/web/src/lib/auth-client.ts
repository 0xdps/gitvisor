import type { User } from "@gitvisor/shared";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001";

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
 */
export async function me(): Promise<User | null> {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
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
 * Called from /auth/callback after GitHub redirects back.
 */
export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("OAuth exchange failed");
}
