import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Read at request time — works correctly in Docker where API_INTERNAL_URL is
// injected as a runtime env var (not a build-time ARG).
const API_BASE =
  process.env["API_INTERNAL_URL"] ?? "http://localhost:3002";

/**
 * Local docker keeps NODE_ENV=development, so the API omits Secure. The
 * browser still talks to an HTTPS origin (WEB_URL / the OAuth redirect).
 * A non-Secure cookie on that origin is discarded when the tab closes.
 */
function browserRequiresSecureCookie(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;
  const visitor = req.headers.get("cf-visitor");
  if (visitor?.includes("https")) return true;
  if (req.nextUrl.protocol === "https:") return true;
  const publicOrigin = process.env["WEB_URL"] ?? process.env["GITHUB_OAUTH_REDIRECT_URI"] ?? "";
  return publicOrigin.startsWith("https://");
}

/** Add Secure, and mirror Max-Age into Expires, before the browser stores the cookie. */
function persistSetCookie(cookie: string, secure: boolean): string {
  let next = cookie;
  if (secure && !/;\s*secure\b/i.test(next)) {
    next += "; Secure";
  }
  if (/;\s*expires=/i.test(next)) return next;
  const maxAge = next.match(/;\s*max-age=(\d+)/i);
  if (!maxAge) return next;
  const seconds = Number(maxAge[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return next;
  return `${next}; Expires=${new Date(Date.now() + seconds * 1000).toUTCString()}`;
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  // Rewrite /api/<rest> → <API_BASE>/<rest>
  const rest = req.nextUrl.pathname.replace(/^\/api/, "") || "/";
  const target = `${API_BASE}${rest}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  // Remove hop-by-hop headers that should not be forwarded
  headers.delete("host");
  headers.delete("connection");
  headers.delete("transfer-encoding");

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // @ts-expect-error duplex is required for streaming request bodies in Node.js
    init.duplex = "half";
    init.body = req.body;
  }

  const upstream = await fetch(target, init);

  const resHeaders = new Headers(upstream.headers);
  // Remove headers that Next.js manages itself
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");

  const secure = browserRequiresSecureCookie(req);
  const setCookies = upstream.headers.getSetCookie().map((cookie) => persistSetCookie(cookie, secure));
  if (setCookies.length > 0) {
    resHeaders.delete("set-cookie");
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });

  // Re-append each cookie on its own header so Max-Age, Expires, and Secure
  // are not collapsed into one comma-joined value.
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
