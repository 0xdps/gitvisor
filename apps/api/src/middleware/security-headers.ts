import { createMiddleware } from "hono/factory";

/**
 * Adds defensive HTTP security headers to every response.
 *
 * Note: HSTS is intentionally omitted — it must be set at the TLS
 * terminator (Caddy / nginx) so it is only served over HTTPS, not over
 * plain HTTP during development.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next();
  // Prevent MIME-type sniffing
  c.header("X-Content-Type-Options", "nosniff");
  // Disallow embedding in iframes (clickjacking defence)
  c.header("X-Frame-Options", "DENY");
  // Send full origin only on same-origin requests; no referrer on downgrades
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // Disable browser features that are never needed by this API
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  // Suppress legacy IE XSS filter — it can introduce its own vulnerabilities on modern stacks
  c.header("X-XSS-Protection", "0");
});
