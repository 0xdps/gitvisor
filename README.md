<div align="center">
  <h1>GitVisor</h1>
  <p>Operational visibility for GitHub — self-hostable, open source.</p>

  [![CI](https://github.com/0xdps/gitvisor/actions/workflows/ci.yml/badge.svg)](https://github.com/0xdps/gitvisor/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![pnpm](https://img.shields.io/badge/pnpm-9-orange)](https://pnpm.io)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org)
</div>

---

GitVisor is an open-source GitHub operational dashboard. Monitor workflow runs, manage repository secrets, track packages, and stream audit logs — all from a single interface. Built to be self-hosted, with a managed cloud option at [gitvisor.dev](https://gitvisor.dev).

## Features

- **Workflow Runs** — Live status, duration, re-run and cancel actions across all repositories
- **Secrets Management** — View metadata, create and rotate repository secrets (values never stored)
- **Package Tracking** — Monitor GitHub Packages across ecosystems
- **Audit Log** — Full audit trail of all actions taken through GitVisor
- **GitHub App** — Uses installation tokens for fine-grained access, not personal access tokens
- **Real-time Sync** — Webhook-driven updates via BullMQ job queue

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     apps/web                        │
│         Next.js 15 · React 19 · Tailwind v4         │
└───────────────────┬─────────────────────────────────┘
                    │ REST
┌───────────────────▼─────────────────────────────────┐
│                     apps/api                        │
│              Hono · Node.js · port 3001             │
└──────────┬────────────────────────┬─────────────────┘
           │ enqueue                │ GitHub API
┌──────────▼────────┐   ┌──────────▼─────────────────┐
│    apps/worker    │   │       packages/github      │
│  BullMQ · Redis   │   │   @octokit/app · webhooks  │
└──────────┬────────┘   └────────────────────────────┘
           │ read/write
┌──────────▼────────┐
│    packages/db    │
│  shared SQLite    │
└───────────────────┘
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TanStack Query v5 |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI |
| API | Hono v4 on Node.js |
| Queue | BullMQ v5 + Redis |
| GitHub | `@octokit/app`, `@octokit/rest`, `@octokit/webhooks` |
| Auth | HMAC-SHA256 signed cookies, GitHub OAuth |
| Database | `better-sqlite3` (shared local SQLite) |
| Monorepo | Turborepo v2, pnpm v9 workspaces |
| Language | TypeScript 5.8 strict |

## Self-Hosting

> **Single-user only.** The OSS core uses a single shared SQLite database for all data. There is no per-user row isolation at the query layer — `listRepositories()`, `listWorkflowRuns()`, and similar reads return data for all stored users. Running GitVisor for more than one person on a single self-hosted instance is **not supported** and will result in data cross-contamination. For multi-user or team use, see [gitvisor.dev](https://gitvisor.dev) (cloud SaaS) or run a dedicated instance per user.

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Redis (or Valkey)
- A [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)

### Quick Start

```bash
git clone https://github.com/0xdps/gitvisor.git
cd gitvisor
pnpm install

# Copy and fill the root env file (one file covers all services)
cp .env.example .env.local

# Start everything
docker compose -f infra/docker/docker-compose.yml up
```

Or run services individually:

```bash
pnpm dev          # all apps via Turborepo
```

### Environment Variables

A single **`.env.local`** at the monorepo root covers all services. Copy from `.env.example` and fill in the values:

```env
NODE_ENV=development
PORT=3001

NEXT_PUBLIC_API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

SESSION_SECRET=          # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/auth/callback

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Optional: paths for local SQLite files (defaults shown)
# REGISTRY_DB_PATH=./registry.sqlite
# DATA_DB_PATH=./data.sqlite
```

## Repository Structure

```
gitvisor/
├── apps/
│   ├── api/         # Hono REST API + webhook receiver
│   ├── web/         # TanStack Start frontend
│   └── worker/      # BullMQ job processor
├── packages/
│   ├── shared/      # Shared TypeScript types
│   ├── github/      # Octokit wrappers
│   ├── queue/       # Queue abstraction + BullMQ impl
│   ├── db/          # DB repository interfaces
│   └── ui/          # Shared React component library
└── infra/
    └── docker/      # Dockerfiles + Docker Compose
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE) — free to self-host, fork, and modify.
