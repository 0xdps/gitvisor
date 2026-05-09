# GitVisor — Complete Build Plan

## Repositories

| Repo | URL | Visibility |
|---|---|---|
| Core (OSS) | https://github.com/0xdps/gitvisor.git | Public |
| Cloud (SaaS) | https://github.com/0xdps/gitvisor-cloud.git | Private |

`gitvisor` is used as a git submodule inside `gitvisor-cloud` at `core/`.

---

## Product Summary

GitVisor is an operational GitHub dashboard providing:
- GitHub Actions overview and rerun shortcuts
- Centralized secret management across repos (metadata + sync, no raw secret storage)
- Package dashboard (npm, GitHub Packages, Docker)
- Developer operational profiles

GitHub remains source-of-truth for execution, storage, and hosting. GitVisor provides visibility, aggregation, and management UX.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui |
| API | Hono on Node.js (standalone server) |
| Worker | BullMQ + Redis (core/OSS) · Cloudflare Queues (cloud — injected via interface) |
| GitHub Integration | Octokit (`@octokit/app`, `@octokit/rest`, `@octokit/webhooks`) |
| Auth | NubeAuth (GitHub OAuth provider, PKCE flow) |
| Per-user DB | MesaHub (`@mesahub/client`) — one SQLite DB per user |
| Registry DB | Single SQLite (maps `user_id → mesahub_db_ref`) |
| Monorepo | Turborepo + pnpm workspaces |
| Containerization | Docker Compose (core self-host target) |

---

## Architecture

### Data Flow

```
GitHub App
    ↓  (webhooks)
Webhook Gateway (Hono)
    ↓  (signature verified)
Queue (BullMQ / CF Queues)
    ↓
Sync Worker
    ↓  (writes metadata)
MesaHub SQLite (per-user DB)
    ↓
Hono API (read path — GitHub NOT touched)
    ↓
TanStack Start Frontend
```

### GitHub Integration Strategy

- **GitHub App** (not OAuth App) — for data access, webhooks, installation tokens
- Webhook-primary ingestion; REST API only for initial historical sync per repo
- Rate limit strategy: copy required metadata to MesaHub on first sync, keep updated via webhooks
- GitHub secrets: names and `updated_at` metadata only — raw values are never stored or read (GitHub API does not expose them)

### Auth Flow (NubeAuth — Web PKCE)

```
1. User clicks "Sign in with GitHub"
2. Frontend generates code_verifier, stores in sessionStorage
3. Redirect to NubeAuth: GET /v1/auth/start?provider=github&app_id=...&return_to=...&code_challenge=...
4. NubeAuth → GitHub OAuth → callback to /auth/callback
5. Server exchanges code: POST /v1/auth/token  →  { sessionToken, userId }
6. Session token set as httpOnly cookie
7. GET /v1/me → { id, email, name }  (userId used as MesaHub DB key)
```

### Secret Handling Flow

```
1. User updates secret value in GitVisor UI
2. GitVisor fetches repo public key from GitHub API
3. Secret encrypted client-side using libsodium (sealed box)
4. Encrypted value sent directly to GitHub API
5. GitHub stores it
GitVisor stores: secret name, repo mapping, updated_at, sync history — no raw values
```

### Per-User DB Strategy

- Each user gets a dedicated MesaHub SQLite DB provisioned on first login
- Registry DB maps `user_id → mesahub_db_ref`
- Schema migrations run against all user DBs via a migration runner (built from day one)
- Webhook bursts are buffered by the queue layer — worker batches writes to MesaHub

---

## Repository Structure

### Core (`gitvisor/`)

```
apps/
  web/          — TanStack Start frontend
  api/          — Hono API server
  worker/       — BullMQ job processor

packages/
  ui/           — shadcn/ui components, shared design system
  db/           — MesaHub client wrappers, schema, migration runner
  github/       — Octokit wrappers, webhook handlers, GitHub App logic
  queue/        — Queue interface + BullMQ implementation (default)
  shared/       — Types, constants, utilities

infra/
  docker/       — docker-compose.yml for self-hosting
  scripts/      — DB migration runner, setup scripts
```

### Cloud (`gitvisor-cloud/`)

```
core/           — git submodule → gitvisor/

apps/
  billing/      — Subscription + payment management
  provisioning/ — MesaHub DB provisioning per user (SaaS-only)

packages/
  cloud-queue/  — Cloudflare Queues implementation of queue interface
  cloud-config/ — SaaS-specific env, feature flags
  stripe/       — Billing integration
```

### Dependency Rule

```
cloud → imports/extends → core
core  → knows nothing about → cloud
```

Cloud injects SaaS implementations (e.g. `CloudflareQueueProvider`) at runtime via environment/config. Core defines the interfaces.

---

## Open Core Model

### Core (MIT licensed — public)
- All GitHub sync logic
- Webhook processing
- Dashboard UI
- Secret orchestration (no raw storage)
- All V1 features

### Cloud-only (private)
- MesaHub DB provisioning per user
- Billing and subscription management
- Cloudflare Queues integration
- SaaS environment configuration
- Usage metering

---

## Self-Hosting

- Docker Compose is the primary self-host target for V1
- Users provide: GitHub App credentials, webhook config, Redis instance
- No support commitment for self-hosted deployments
- Documentation provided for setup

---

## SaaS Model

| Tier | Features |
|---|---|
| Free | Public repositories, basic dashboard, limited analytics |
| Paid | Private repositories, team/org features, secret orchestration, advanced analytics |

---

## Data Stored in GitVisor

| Stored | Not Stored |
|---|---|
| Workflow run metadata and status history | Raw secret values |
| Secret names, mappings, `updated_at` timestamps | Build artifacts or logs |
| Package metadata | Package binaries |
| Audit logs | Full workflow logs |
| Cached GitHub state | Deployment artifacts |
| User/org settings | |
| Analytics aggregates | |

---

## Phase 1 — Foundation

### Goals
- Working monorepo
- GitHub App created and connected
- Webhook ingestion pipeline
- Initial repo + workflow sync
- Basic dashboard (Actions overview)
- Secret listing and update flow
- NubeAuth login working
- MesaHub per-user DB provisioned on login

### Tasks

#### Monorepo Setup
- [ ] Init Turborepo + pnpm workspaces in `gitvisor/`
- [ ] Scaffold `apps/web`, `apps/api`, `apps/worker`
- [ ] Scaffold `packages/ui`, `packages/db`, `packages/github`, `packages/queue`, `packages/shared`
- [ ] Configure `turbo.json` pipeline (build, dev, lint, test)
- [ ] Docker Compose for local dev (Redis + registry SQLite)

#### GitHub App
- [ ] Create GitHub App (permissions: Actions read, Secrets write, Packages read, Repository metadata read, Webhooks)
- [ ] Implement installation flow — users install app on their account/org
- [ ] Octokit `@octokit/app` — installation token auto-refresh
- [ ] Webhook signature verification middleware (Hono)
- [ ] Webhook event handlers: `workflow_run`, `workflow_job`, `push`, `installation`

#### Auth (NubeAuth)
- [ ] Register GitVisor app in NubeAuth (GitHub provider)
- [ ] PKCE login flow in TanStack Start
- [ ] Session cookie set server-side at `/auth/callback`
- [ ] Auth middleware in Hono API

#### Database Layer
- [ ] Registry DB schema: `users`, `installations`, `repositories`
- [ ] MesaHub DB provisioned per user on first login
- [ ] Migration runner that applies schema to all user DBs
- [ ] Per-user schema: `workflow_runs`, `workflow_jobs`, `secrets_meta`, `repositories`, `audit_log`

#### Initial Sync
- [ ] On app install: queue full historical sync job for each repo
- [ ] Worker fetches workflow runs via REST API, writes to MesaHub
- [ ] Webhooks keep data current after initial sync

#### Frontend — Actions Dashboard
- [ ] Layout with sidebar navigation
- [ ] Repositories list
- [ ] Workflow runs per repo (status, duration, branch, actor)
- [ ] Rerun workflow action (calls GitHub API directly)
- [ ] Deep-link to GitHub Actions page

#### Frontend — Secrets
- [ ] List secrets by repo (name + last updated — no values)
- [ ] Update secret: fetch public key → encrypt → send to GitHub
- [ ] Bulk update across repos

---

## Phase 2 — Package Dashboard & Developer Profiles

### Goals
- Package listing and metadata
- Developer operational profile pages (public)
- Analytics groundwork

### Tasks
- [ ] Webhook handlers: `package`, `release`
- [ ] Package metadata sync (npm, GitHub Packages, Docker)
- [ ] Package dashboard: version history, visibility, download counts
- [ ] Developer profile: deployment frequency, release cadence, workflow success rate, active repos
- [ ] Public profile pages (shareable URL)
- [ ] Profile design: inspired by checkmygit visual language

---

## Phase 3 — Org/Team, Analytics, Notifications

### Goals
- Multi-user org support
- Advanced analytics
- Audit tooling
- Notification system

### Tasks
- [ ] Org installs — multiple users under one org
- [ ] Role-based access (org owner, member)
- [ ] Workflow success rate trends
- [ ] Secret drift detection across repos (metadata comparison)
- [ ] Audit log UI
- [ ] Notifications (webhook failures, workflow failures, secret staleness)

---

## Key Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| GitHub integration | GitHub App | Granular permissions, webhooks, no manual API key, better rate limits |
| Auth | NubeAuth (GitHub OAuth) | Own project, supports GitHub provider, PKCE, session tokens |
| Frontend | TanStack Start | Faster than Next.js, type-safe routing, Vite-based, same ecosystem as TanStack Query |
| Per-user DB | MesaHub (SQLite-per-user) | No cross-user queries, no write lock contention, simple isolation, own project |
| Queue (core) | BullMQ + Redis | Mature, reliable, self-hostable |
| Queue (cloud) | Cloudflare Queues | Managed, no Redis ops overhead in SaaS |
| Secret storage | Metadata only — no raw values | Lower compliance burden, GitHub is the vault |
| Data sync strategy | Webhook-primary + initial REST sync | Avoids rate limit exhaustion, near-real-time updates |
| Open core split | Core OSS, cloud-only provisioning/billing | Proven model, clean interface boundary |
| Multi-tenancy | SQLite-per-user (MesaHub) | Simpler schema, natural isolation, no `tenant_id` on every table |

---

## Cloud Repo Setup

```bash
# In gitvisor-cloud/
git submodule add https://github.com/0xdps/gitvisor.git core
git submodule update --init --recursive

# CI must include:
# uses: actions/checkout@v4
# with:
#   submodules: recursive
```

**Always pin core to a tag/commit in cloud — never float on trunk.**

---

## V1 Non-Goals

- Live log streaming
- CI/CD replacement
- Secrets vault (no raw storage)
- Kubernetes or runner management
- AI debugging
- Social/activity feed
- Deployment orchestration
