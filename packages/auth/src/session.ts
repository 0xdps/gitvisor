import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  githubToken: string;
  userId: string;
  githubUsername: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  /** Unix timestamp seconds */
  exp: number;
}

const SEP = ".";

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Sign a session payload, returning an opaque token suitable for an httpOnly cookie.
 * Format: base64url(JSON) + "." + hmac-sha256(base64url(JSON))
 */
export function signSession(payload: SessionPayload, secret: string): string {
  const data = b64url(JSON.stringify(payload));
  return `${data}${SEP}${sign(data, secret)}`;
}

/**
 * Verify and decode a session token.
 * Returns the payload if valid and not expired, null otherwise.
 */
export function verifySession(token: string, secret: string): SessionPayload | null {
  const sep = token.lastIndexOf(SEP);
  if (sep === -1) return null;

  const data = token.slice(0, sep);
  const sig = token.slice(sep + 1);

  // Constant-time comparison to prevent timing attacks
  const expected = sign(data, secret);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
  } catch {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/** Session TTL: 30 days in seconds */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
