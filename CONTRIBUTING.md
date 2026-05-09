# Contributing to GitVisor

Thank you for your interest in contributing. This document covers everything you need to get started.

## Development Setup

```bash
git clone https://github.com/0xdps/gitvisor.git
cd gitvisor
pnpm install
```

Copy the example env files before starting:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Start all services in dev mode:

```bash
pnpm dev
```

## Project Structure

| Package | Purpose |
|---|---|
| `apps/api` | Hono REST API, webhook handler |
| `apps/web` | TanStack Start frontend |
| `apps/worker` | BullMQ background job processor |
| `packages/shared` | Shared TypeScript types |
| `packages/github` | Octokit wrappers |
| `packages/queue` | Queue abstraction + BullMQ implementation |
| `packages/db` | Database repository interfaces |
| `packages/ui` | Shared React component library |

## Guidelines

### Code Style

- TypeScript strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- No `any` types — use proper types or `unknown` + narrowing
- No raw `console.log` in production paths — errors are handled at boundaries
- Prefer explicit return types on public functions

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat(api): add repository filter endpoint
fix(worker): retry on transient GitHub 5xx errors
chore(deps): update @octokit/rest to v22
```

Scopes: `api`, `web`, `worker`, `shared`, `github`, `queue`, `db`, `ui`, `infra`

### Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes with tests if applicable
3. Ensure CI passes: `pnpm typecheck && pnpm lint && pnpm build`
4. Open a PR with a clear description of the change and why

### Open Core Boundary

**Core rule: `core` packages never import from cloud.** The cloud repo (`gitvisor-cloud`) imports core, not the other way.

If a feature requires SaaS-specific infrastructure (MesaHub, billing, etc.), it belongs in `gitvisor-cloud`, not here.

### Security

If you find a security vulnerability, please **do not** open a public issue. Email [security@gitvisor.dev](mailto:security@gitvisor.dev) instead. We'll respond within 48 hours.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
