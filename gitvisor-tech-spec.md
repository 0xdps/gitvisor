# GitVisor - Technical Specification & Product Architecture

## Overview

GitVisor is an open-source GitHub operations dashboard and management platform focused on:

- GitHub Actions overview
- Centralized secrets management
- Package visibility
- Developer operational profiles

GitVisor is NOT intended to replace GitHub initially.

The goal is to provide:
- better operational UX
- multi-repo management
- lightweight analytics
- centralized workflows

while GitHub remains the execution/source-of-truth platform.

---

# Vision

## Core Philosophy

GitVisor should:
- stay lightweight
- remain GitHub-native
- avoid overengineering
- provide operational visibility
- simplify GitHub management

GitHub remains responsible for:
- workflow execution
- package storage
- secret encryption/storage
- repository hosting
- deployments

GitVisor provides:
- orchestration
- visibility
- aggregation
- operational UX

---

# Product Scope

## V1 Features

### 1. GitHub Actions Dashboard

Features:
- workflow overview
- recent runs
- success/failure status
- workflow duration
- repository activity
- rerun workflow shortcut
- deep-link to GitHub Actions page

NOT included in V1:
- live logs
- terminal streaming
- log storage
- advanced observability
- custom runners
- workflow execution

---

### 2. Centralized Secret Management

Features:
- update secrets across multiple repositories
- environment grouping
- repo grouping
- secret drift detection
- audit history
- bulk updates

Important:
GitVisor DOES NOT permanently store secret values.

Flow:
1. User updates secret
2. GitVisor fetches GitHub public key
3. Secret encrypted client/backend-side
4. Secret sent directly to GitHub
5. GitHub stores encrypted secret

GitVisor stores only:
- metadata
- mappings
- timestamps
- sync history

---

### 3. Package Dashboard

Features:
- package listing
- release history
- package metadata
- package visibility
- download/version overview

Supported initially:
- npm packages
- GitHub Packages
- Docker images

---

### 4. Developer Operational Profiles

Inspired partially by:
https://github.com/whoisyurii/checkmygit

Focus:
- operational developer identity
- engineering activity
- workflow health
- release consistency
- package maintenance

NOT:
- social network
- LinkedIn clone
- activity feed platform

Potential profile metrics:
- deployment frequency
- release cadence
- workflow success rate
- package maintenance activity
- active repositories
- contribution consistency

---

# Architecture

## High-Level Architecture

```text
GitHub App
    ↓
Webhook Gateway
    ↓
Queue System
    ↓
Sync Workers
    ↓
Postgres Database
    ↓
REST/GraphQL API
    ↓
Frontend Dashboard
```

---

# GitHub Integration

## Authentication Method

Use:
- GitHub App
NOT:
- classic OAuth application

Benefits:
- granular permissions
- webhook support
- organization installs
- better rate limits
- secure architecture

---

# GitHub APIs Used

## REST API

Used for:
- Actions
- Secrets
- Packages
- Repositories
- Workflow runs

Examples:
- workflow runs
- workflow jobs
- rerun workflow
- packages metadata
- org/repo secrets

---

## GraphQL API

Used for:
- profile aggregation
- dashboard summaries
- contribution analytics
- repository relationships

---

## Webhooks

Primary ingestion mechanism.

Examples:
- workflow_run
- workflow_job
- push
- release
- package
- installation
- repository events

GitVisor should rely primarily on:
- webhooks
- incremental sync

NOT heavy polling.

---

# Data Storage Strategy

## GitHub remains source of truth for:
- repositories
- workflow execution
- package storage
- secrets
- releases

---

## GitVisor stores:
- workflow metadata
- status history
- analytics
- audit logs
- secret mappings
- package metadata
- user/org settings
- cached GitHub state

---

## GitVisor DOES NOT store:
- raw secret values
- build artifacts
- package binaries
- deployment artifacts
- full logs

---

# Database Design

## Primary Database

Recommended:
- PostgreSQL

Stores:
- users
- organizations
- repositories
- workflows
- package metadata
- audit logs
- analytics metadata

---

## Queue Layer

Recommended:
- Redis / Valkey
- BullMQ
- Cloudflare Queues

Used for:
- webhook processing
- retries
- background sync jobs

---

# Frontend

## Recommended Stack

- Next.js
- React
- TailwindCSS
- shadcn/ui

Goals:
- fast
- modern
- operational dashboard UX

---

# Backend

## Recommended Stack

Options:
- Hono
- Node.js
- Bun
- Nitro

Recommended approach:
- API-first architecture
- modular services
- queue-driven processing

---

# Security Model

## Secret Handling

GitVisor should:
- avoid permanent secret storage
- avoid becoming a vault provider
- encrypt before sending to GitHub

Benefits:
- lower compliance burden
- easier trust model
- reduced liability

---

## Webhook Security

Required:
- signature verification
- replay protection
- rate limiting
- queue isolation

---

# Self Hosting Strategy

GitVisor is:
- open source
- self-hostable
- SaaS available

---

## SaaS Model

Free:
- public repositories
- limited analytics

Paid:
- private repositories
- team/org features
- advanced analytics
- secret orchestration

---

## Self-Hosted Model

Users provide:
- GitHub App credentials
- webhook configuration
- database
- queue system

Initial self-hosting target:
- Docker Compose

Advanced deployment support can come later.

---

# Multi-Tenant Model

Entities:
- User
- Organization
- Repository
- Environment
- Workflow
- Package

Permissions:
- org-scoped access
- repository access control
- role-based access later

---

# Non Goals (V1)

GitVisor V1 should NOT attempt:
- CI replacement
- deployment orchestration
- secrets vault platform
- live log streaming
- Kubernetes management
- runner orchestration
- AI debugging platform
- social developer network

---

# Future Possibilities

Potential future modules:
- deployment orchestration
- workflow intelligence
- flaky workflow detection
- AI-assisted debugging
- package ecosystem analytics
- deployment timelines
- org health metrics
- team operational dashboards

These should come only after:
- product validation
- real user feedback
- OSS traction
- operational stability

---

# Product Positioning

GitVisor is:

"Operational visibility and management for GitHub developers and teams."

NOT:
- GitHub replacement
- CI platform
- DevOps mega-suite

GitVisor focuses on:
- simplicity
- operational clarity
- centralized management
- GitHub-native workflows

---

# Suggested Repository Structure

```text
apps/
  web/
  api/
  worker/

packages/
  ui/
  db/
  github/
  queue/
  shared/

infra/
  docker/
  scripts/
```

---

# Initial MVP Timeline

## Phase 1
- GitHub App integration
- repo sync
- workflow overview
- secret sync
- basic dashboard

## Phase 2
- package overview
- developer profiles
- analytics
- public profile pages

## Phase 3
- org/team support
- advanced analytics
- notifications
- audit tooling

---

# Branding

Working Name:
- GitVisor

Positioning:
- lightweight GitHub operations platform
- modern GitHub management dashboard
- centralized workflow + secrets visibility

