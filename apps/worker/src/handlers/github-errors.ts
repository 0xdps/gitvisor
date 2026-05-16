export function getGitHubErrorStatus(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

export function isExpectedGitHubError(err: unknown, statuses: number[]): boolean {
  const status = getGitHubErrorStatus(err);
  return status !== null && statuses.includes(status);
}