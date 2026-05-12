import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie name must match config.session.cookieName in apps/api/src/config.ts
const SESSION_COOKIE = "gitvisor_session";

// Routes that require a session cookie. Actual token validation happens at
// the API layer; middleware only checks for cookie presence to give a fast
// redirect rather than a flash of protected content.
export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE);
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
    "/secrets/:path*",
    "/packages/:path*",
    "/profile/:path*",
    "/audit-log/:path*",
    "/analytics/:path*",
  ],
};
