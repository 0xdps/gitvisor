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
│         TanStack Start · React 19 · Tailwind v4     │
└───────────────────┬─────────────────────────────────┘
                    │ REST
┌───────────────────▼─────────────────────────────────┐
│                     apps/api                        │
│              Hono · Node.js · port 3001             │
└──────────┬────────────────────────┬─────────────────┘
           │ enqueue                │ GitHub API
┌──────────▼────────┐   ┌──────────▼─────────────────┐
│    apps/worker    │   │       packages/github       │
│  BullMQ · Redis   │   │   @octokit/app · webhooks   │
└──────────┬────────┘   └────────────────────────────-┘
           │ read/write
┌──────────▼────────┐
│    packages/db    │
│  per-user SQLite  │
└───────────────────┘
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start v1, TanStack Router, TanStack Query v5, React 19 |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI |
| API | Hono v4 on Node.js |
| Queue | BullMQ v5 + Redis |
| GitHub | `@octokit/app`, `@octokit/rest`, `@octokit/webhooks` |
| Auth | NubeAuth (PKCE OAuth) |
| Monorepo | Turborepo v2, pnpm v9 workspaces |
| Language | TypeScript 5.8 strict |

## Self-Hosting

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

# Copy and fill env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start everything
docker compose -f infra/docker/docker-compose.yml up
```

Or run services individually:

```bash
pnpm dev          # all apps via Turborepo
```

### GitHub App Setup

1. Create a GitHub App at [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Set the webhook URL to `https://your-domain/webhooks/github`
3. Required permissions:
   - **Repository**: Actions (read), Secrets (read/write), Packages (read), Contents (read)
   - **Organization**: Members (read)
4. Subscribe to events: `workflow_run`, `push`, `installation`, `package`
5. Generate a private key and note the App ID
6. Install the app on your organization/repositories

### Environment Variables

**`apps/api/.env`**

```env
NODE_ENV=production
PORT=3001

# GitHub App
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# NubeAuth
NUBE_AUTH_GATEWAY_URL=
NUBE_AUTH_APP_ID=
NUBE_AUTH_APP_SECRET=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**`apps/web/.env`**

```env
VITE_NUBE_AUTH_GATEWAY_URL=
VITE_NUBE_AUTH_APP_ID=
VITE_API_URL=http://localhost:3001
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
