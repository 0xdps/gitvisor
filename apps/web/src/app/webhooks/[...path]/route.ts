import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_BASE =
  process.env["API_INTERNAL_URL"] ?? "http://localhost:3002";

async function proxy(req: NextRequest): Promise<NextResponse> {
  // Rewrite /webhooks/<rest> → <API_BASE>/webhooks/<rest>
  const rest = req.nextUrl.pathname; // keep the full path including /webhooks/...
  const target = `${API_BASE}${rest}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
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
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const POST = proxy;
export const GET = proxy;
