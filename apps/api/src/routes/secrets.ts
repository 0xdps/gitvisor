import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";

export const secretsRouter = new Hono<AuthEnv>();

secretsRouter.use("*", requireAuth);

/**
 * GET /secrets?repositoryId=
 * Lists secret metadata (names + last updated) from MesaHub.
 * Raw secret values are never stored or returned.
 */
secretsRouter.get("/", async (c) => {
  const _user = c.get("user");
  const _repositoryId = c.req.query("repositoryId");

  // TODO: query UserDbRepository.listSecretMeta()
  return c.json({ ok: true, data: [] });
});

/**
 * PUT /secrets/:repoId/:secretName
 * Updates a secret across one or more repos.
 * Body: { value: string, repositoryIds?: string[] }
 *
 * Flow:
 * 1. Fetch repo public key from GitHub
 * 2. Encrypt value with libsodium sealed box
 * 3. Send encrypted value to GitHub API
 * 4. Update secret metadata in MesaHub
 * Note: raw value is never persisted anywhere.
 */
secretsRouter.put("/:repoId/:secretName", async (c) => {
  const _user = c.get("user");
  const _repoId = c.req.param("repoId");
  const _secretName = c.req.param("secretName");
  const _body = await c.req.json<{ value: string; repositoryIds?: string[] }>();

  // TODO: implement encrypt-and-push flow
  return c.json({ ok: true, data: null });
});

/**
 * DELETE /secrets/:repoId/:secretName
 * Deletes a secret from GitHub and removes metadata from MesaHub.
 */
secretsRouter.delete("/:repoId/:secretName", async (c) => {
  const _user = c.get("user");
  const _repoId = c.req.param("repoId");
  const _secretName = c.req.param("secretName");

  // TODO: call deleteRepoSecret() + UserDbRepository.deleteSecretMeta()
  return c.json({ ok: true, data: null });
});
