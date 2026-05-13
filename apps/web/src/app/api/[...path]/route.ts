import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Read at request time — works correctly in Docker where API_INTERNAL_URL is
// injected as a runtime env var (not a build-time ARG).
const API_BASE =
  process.env["API_INTERNAL_URL"] ?? "http://localhost:3002";

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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
