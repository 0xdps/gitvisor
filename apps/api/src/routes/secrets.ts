import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { AuthEnv } from "../middleware/auth.js";
import {
  getInstallationOctokit,
  getRepoPublicKey,
  upsertRepoSecret,
  deleteRepoSecret,
  listRepoSecrets,
  mapSecretMeta,
} from "@gitvisor/github";
import { createRequire } from "module";
import type * as SodiumType from "libsodium-wrappers";
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sodium: typeof SodiumType = _require("libsodium-wrappers");
import type { UserDbRepository } from "@gitvisor/db";
import { makeUserRateLimiter } from "../middleware/rate-limit.js";

async function encryptSecret(publicKeyB64: string, value: string): Promise<string> {
  await sodium.ready;
  const publicKey = sodium.from_base64(publicKeyB64, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(value);
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, publicKey);
  return sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
}

export function createSecretsRouter(
  getUserDb: (userId: string) => Promise<UserDbRepository>,
  requireAuth: MiddlewareHandler<AuthEnv>,
) {
  const router = new Hono<AuthEnv>();

  // 30 secret operations per minute per user — each operation calls the GitHub API
  const secretsLimiter = makeUserRateLimiter(30, 60_000);

  router.use("*", requireAuth);

  /**
   * GET /secrets?repositoryId=
   * Lists secret metadata (names + last updated) from the user's DB.
   * Raw secret values are never stored or returned.
   */
  router.get("/", async (c) => {
    const user = c.get("user");
    const repositoryId = c.req.query("repositoryId") || undefined;
    const userDb = await getUserDb(user.id);
    const secrets = await userDb.listSecretMeta(repositoryId);
    return c.json({ ok: true, data: secrets });
  });

  /**
   * PUT /secrets/:repoId/:secretName
   * Encrypts the value server-side (libsodium sealed box) and pushes to GitHub.
   * Body: { value: string }
   * The raw value is never written to any database.
   */
  router.put("/:repoId/:secretName", async (c) => {
    const user = c.get("user");
    if (!secretsLimiter(user.id)) return c.json({ ok: false, error: "Too many requests" }, 429);
    const repoId = Number(c.req.param("repoId"));
    if (!Number.isFinite(repoId)) return c.json({ ok: false, error: "Invalid repository ID" }, 400);
    const secretName = c.req.param("secretName");
    const body = await c.req.json<{ value: string }>();

    if (!body.value) return c.json({ ok: false, error: "Missing value" }, 400);

    // GitHub secret names must match [A-Z][A-Z0-9_]* (uppercase, no leading digits)
    if (!/^[A-Z][A-Z0-9_]*$/.test(secretName)) {
      return c.json(
        { ok: false, error: "Secret name must start with a letter and contain only uppercase letters, digits, and underscores" },
        400,
      );
    }

    const userDb = await getUserDb(user.id);
    const repo = await userDb.getRepository(repoId);
    if (!repo) return c.json({ ok: false, error: "Repository not found" }, 404);

    const octokit = await getInstallationOctokit(repo.installationId);
    const { key, keyId } = await getRepoPublicKey(octokit as never, repo.owner, repo.name);
    const encryptedValue = await encryptSecret(key, body.value);
    await upsertRepoSecret(octokit as never, repo.owner, repo.name, secretName, encryptedValue, keyId);

    const mapped = mapSecretMeta(
      { name: secretName, updated_at: new Date().toISOString() },
      String(repoId),
      user.id,
    );
    await userDb.upsertSecretMeta(mapped);

    return c.json({ ok: true, data: null });
  });

  /**
   * DELETE /secrets/:repoId/:secretName
   * Deletes a secret from GitHub and removes metadata from the user's DB.
   */
  router.delete("/:repoId/:secretName", async (c) => {
    const user = c.get("user");
    if (!secretsLimiter(user.id)) return c.json({ ok: false, error: "Too many requests" }, 429);
    const repoId = Number(c.req.param("repoId"));
    if (!Number.isFinite(repoId)) return c.json({ ok: false, error: "Invalid repository ID" }, 400);
    const secretName = c.req.param("secretName");

    if (!/^[A-Z][A-Z0-9_]*$/.test(secretName)) {
      return c.json(
        { ok: false, error: "Secret name must start with a letter and contain only uppercase letters, digits, and underscores" },
        400,
      );
    }

    const userDb = await getUserDb(user.id);
    const repo = await userDb.getRepository(repoId);
    if (!repo) return c.json({ ok: false, error: "Repository not found" }, 404);

    const octokit = await getInstallationOctokit(repo.installationId);
    await deleteRepoSecret(octokit as never, repo.owner, repo.name, secretName);
    await userDb.deleteSecretMeta(String(repoId), secretName);

    return c.json({ ok: true, data: null });
  });

  // ── Secret Groups ─────────────────────────────────────────────────────────

  /**
   * GET /secrets/groups
   * List all secret groups for the authenticated user.
   */
  router.get("/groups", async (c) => {
    const user = c.get("user");
    const userDb = await getUserDb(user.id);
    const groups = await userDb.listSecretGroups();
    return c.json({ ok: true, data: groups });
  });

  /**
   * POST /secrets/groups
   * Create a new secret group.
   * Body: { name, description?, secretNames, repoIds }
   */
  router.post("/groups", async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      name: string;
      description?: string;
      secretNames: string[];
      repoIds: string[];
    }>();

    if (!body.name?.trim()) return c.json({ ok: false, error: "name is required" }, 400);
    if (!Array.isArray(body.secretNames)) return c.json({ ok: false, error: "secretNames must be an array" }, 400);
    if (!Array.isArray(body.repoIds)) return c.json({ ok: false, error: "repoIds must be an array" }, 400);

    for (const n of body.secretNames) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(n)) {
        return c.json({ ok: false, error: `Invalid secret name: ${n}` }, 400);
      }
    }

    const userDb = await getUserDb(user.id);
    const group = await userDb.createSecretGroup({
      userId: user.id,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      secretNames: body.secretNames,
      repoIds: body.repoIds,
    });
    return c.json({ ok: true, data: group }, 201);
  });

  /**
   * PUT /secrets/groups/:groupId
   * Update a secret group (name, description, secretNames, repoIds).
   */
  router.put("/groups/:groupId", async (c) => {
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    const body = await c.req.json<Partial<{
      name: string;
      description: string | null;
      secretNames: string[];
      repoIds: string[];
    }>>();

    if (body.secretNames) {
      for (const n of body.secretNames) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(n)) {
          return c.json({ ok: false, error: `Invalid secret name: ${n}` }, 400);
        }
      }
    }

    const userDb = await getUserDb(user.id);
    const existing = await userDb.getSecretGroup(groupId);
    if (!existing || existing.userId !== user.id) {
      return c.json({ ok: false, error: "Group not found" }, 404);
    }

    const updated = await userDb.updateSecretGroup(groupId, {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...("description" in body && { description: body.description ?? null }),
      ...(body.secretNames !== undefined && { secretNames: body.secretNames }),
      ...(body.repoIds !== undefined && { repoIds: body.repoIds }),
    });
    return c.json({ ok: true, data: updated });
  });

  /**
   * DELETE /secrets/groups/:groupId
   * Delete a secret group (does NOT delete secrets from GitHub).
   */
  router.delete("/groups/:groupId", async (c) => {
    const user = c.get("user");
    const groupId = c.req.param("groupId");
    const userDb = await getUserDb(user.id);
    const existing = await userDb.getSecretGroup(groupId);
    if (!existing || existing.userId !== user.id) {
      return c.json({ ok: false, error: "Group not found" }, 404);
    }
    await userDb.deleteSecretGroup(groupId);
    return c.json({ ok: true, data: null });
  });

  /**
   * POST /secrets/groups/:groupId/rotate
   * Push new secret values for all secretNames to all repos in the group.
   * Body: { secrets: { [name: string]: string } }
   * Returns per-repo results so the UI can show progress.
   */
  router.post("/groups/:groupId/rotate", async (c) => {
    const user = c.get("user");
    if (!secretsLimiter(user.id)) return c.json({ ok: false, error: "Too many requests" }, 429);
    const groupId = c.req.param("groupId");
    const body = await c.req.json<{ secrets: Record<string, string> }>();

    if (!body.secrets || typeof body.secrets !== "object") {
      return c.json({ ok: false, error: "secrets object is required" }, 400);
    }

    const userDb = await getUserDb(user.id);
    const group = await userDb.getSecretGroup(groupId);
    if (!group || group.userId !== user.id) {
      return c.json({ ok: false, error: "Group not found" }, 404);
    }

    // Validate that all provided secret names belong to the group
    for (const name of Object.keys(body.secrets)) {
      if (!group.secretNames.includes(name)) {
        return c.json({ ok: false, error: `Secret ${name} is not in this group` }, 400);
      }
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        return c.json({ ok: false, error: `Invalid secret name: ${name}` }, 400);
      }
    }

    const results: { repoId: string; ok: boolean; error?: string }[] = [];

    for (const repoId of group.repoIds) {
      // Find the repository by our internal ID
      const allRepos = await userDb.listRepositories();
      const repo = allRepos.find((r) => r.id === repoId);
      if (!repo) {
        results.push({ repoId, ok: false, error: "Repository not found" });
        continue;
      }
      try {
        const octokit = await getInstallationOctokit(repo.installationId);
        const { key, keyId } = await getRepoPublicKey(octokit as never, repo.owner, repo.name);
        for (const [name, value] of Object.entries(body.secrets)) {
          const encryptedValue = await encryptSecret(key, value);
          await upsertRepoSecret(octokit as never, repo.owner, repo.name, name, encryptedValue, keyId);
          const mapped = mapSecretMeta(
            { name, updated_at: new Date().toISOString() },
            repo.id,
            user.id,
          );
          await userDb.upsertSecretMeta(mapped);
        }
        results.push({ repoId, ok: true });
      } catch (err) {
        results.push({ repoId, ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    await userDb.touchSecretGroupRotatedAt(groupId);
    const allOk = results.every((r) => r.ok);
    return c.json({ ok: allOk, data: { results } }, allOk ? 200 : 207);
  });

  return router;
}
