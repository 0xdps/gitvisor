import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie name must match config.session.cookieName in apps/api/src/config.ts
const SESSION_COOKIES = ["gitvisor_session", "__Host-gitvisor_session"];

// Routes that require a session cookie. Actual token validation happens at
// the API layer; middleware only checks for cookie presence to give a fast
// redirect rather than a flash of protected content.
export function middleware(request: NextRequest) {
  const session = SESSION_COOKIES.map((name) => request.cookies.get(name)).find(Boolean);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/repositories/:path*",
    "/workflows/:path*",
    "/pull-requests",
    "/pull-requests/:path*",
    "/releases/:path*",
    "/secrets/:path*",
    "/feedback/:path*",
    "/packages/:path*",
    "/profile/:path*",
    "/audit-log/:path*",
    "/analytics/:path*",
  ],
};
