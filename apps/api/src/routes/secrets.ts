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

  return router;
}
