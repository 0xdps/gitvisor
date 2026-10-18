const KEY = "gitvisor:first-sync";
/** A first sync of a large account can take a few minutes. */
const MAX_AGE_MS = 10 * 60_000;

export function markFirstSync(): void {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode). The dashboard still loads.
  }
}

export function firstSyncStartedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const at = raw ? Number(raw) : NaN;
    if (!Number.isFinite(at)) return null;
    if (Date.now() - at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return at;
  } catch {
    return null;
  }
}

export function clearFirstSync(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
