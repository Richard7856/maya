# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maya is a property management SaaS for co-living buildings in Mexico. It handles tenant payments (Stripe, MXN), maintenance incidents, cleaning scheduling, complaints, access control, and onboarding — all with Mexican localization (es_MX, RFC tax IDs, MXN currency).

## Monorepo Structure

- **pnpm workspaces** + **Turborepo** orchestration
- `pnpm-workspace.yaml` defines: `apps/*` and `packages/*`

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `backend/` | Python/FastAPI | API server (not in pnpm workspace — standalone Python project) |
| `apps/web/` | Next.js | Admin dashboard (stub) |
| `apps/mobile-tenant/` | React Native/Expo | Tenant app (stub) |
| `apps/mobile-cleaning/` | React Native/Expo | Cleaning staff app (stub) |
| `packages/types/` | TypeScript | Shared domain types & enums mirroring DB schema |
| `packages/utils/` | TypeScript | Date, currency, and helper functions |
| `packages/api-client/` | TypeScript + Axios | HTTP client wrapping all API endpoints |
| `packages/ui-mobile/` | React Native | Shared mobile UI components (stub) |
| `supabase/` | SQL | Migrations and seed data |
| `infrastructure/` | Docker Compose + Traefik | Dev and prod deployment |
| `n8n/` | n8n workflows | Automation (WhatsApp notifications, payment reminders) |

## Commands

### TypeScript (monorepo root)
```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Start all apps in dev mode (turbo)
pnpm build                # Build all packages/apps (turbo, respects dependency graph)
pnpm lint                 # Lint all packages/apps
pnpm type-check           # TypeScript type checking across workspace
pnpm test                 # Run tests across workspace
```

### Backend (Python)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # Dev server
pytest                                       # Run tests
```

### Infrastructure
```bash
cd infrastructure
docker compose up -d                         # Dev: API + n8n
docker compose -f docker-compose.prod.yml up -d  # Prod: adds Traefik TLS
```

### Supabase
Database changes are managed via raw SQL migrations in `supabase/migrations/`. There is no Supabase CLI in use — migrations are applied manually through the Supabase dashboard or MCP tools. Seed data: `supabase/seed.sql`.

## Architecture

### Auth Flow
1. Users authenticate via Supabase Auth (JWT issued by Supabase)
2. Frontend sends `Authorization: Bearer <jwt>` to FastAPI
3. FastAPI validates JWT using `SUPABASE_JWT_SECRET` (HS256), fetches `user_profiles` row
4. Role guards enforce access: `admin`, `tenant`, `cleaning`, `security`

### Two-Layer Security Model
- **Database layer**: Supabase RLS policies enforce row-level access when using anon/user keys (frontend direct queries)
- **Application layer**: FastAPI uses service_role key (bypasses RLS) and enforces access via Python role guards in `backend/app/dependencies/auth.py`

### Payment Flow (Stripe)
1. Tenant calls `POST /api/v1/payments/{id}/pay` → backend creates Stripe PaymentIntent (MXN centavos)
2. Backend returns `client_secret` → mobile app renders Stripe PaymentSheet
3. Stripe webhook `POST /api/v1/payments/webhook/stripe` handles `payment_intent.succeeded`/`failed`
4. On success: payment marked paid, account unlocked, n8n workflow triggered for notifications

### File Uploads (Presigned URLs)
FastAPI never handles binary data. `POST /api/v1/storage/presign` returns a signed Supabase Storage URL; clients PUT files directly. Buckets are restricted by role.

### n8n Integration
Backend triggers n8n workflows via `POST http://n8n:5678/webhook/{workflow_name}` with `X-Maya-Webhook-Secret` header. Key workflows: WF-02 (day-11 payment lock), WF-03 (payment confirmation notifications via WhatsApp + push).

### Shared Packages Pattern
`packages/types` mirrors DB enums/DTOs → consumed by `packages/api-client` and apps. Changes to DB schema should be reflected in `packages/types/src/index.ts`.

## Backend Layout

```
backend/app/
├── main.py                    # FastAPI app, CORS, router mounts
├── config.py                  # Pydantic Settings (env vars)
├── models/user.py             # UserProfile model + UserRole enum
├── dependencies/
│   ├── auth.py                # JWT validation, role guards (require_admin, require_tenant, etc.)
│   └── supabase.py            # Service-role client singleton
├── routers/
│   ├── buildings.py           # /api/v1/buildings — list, KPIs, rooms
│   ├── payments.py            # /api/v1/payments — Stripe intents, access codes, webhook
│   └── storage.py             # /api/v1/storage — presigned upload URLs
└── integrations/
    ├── n8n.py                 # Webhook trigger helper
    ├── push.py                # Expo push notifications
    └── whatsapp.py            # Meta Cloud API (es_MX templates)
```

All API routes are prefixed with `/api/v1/`. Health check at `GET /health`.

## Database Schema Highlights

Key tables: `buildings`, `rooms`, `user_profiles`, `leases`, `payments`, `onboarding_applications`, `incidents`, `complaints` (with anonymous `complaints_safe` view), `tickets`, `cleaning_assignments`, `cleaning_sessions`, `access_events`, `guest_accesses`, `notifications`, `moveout_requests`, `eviction_cases`.

- `user_profiles.is_locked` — set on day 11 of non-payment (WF-02)
- `leases.access_code_encrypted` — currently plaintext, Phase 7 will encrypt with `APP_SECRET_KEY`
- `leases.payment_day` — 1-28, controls when rent is due
- `complaints` uses `is_anonymous` (default TRUE) and `complaints_safe` view hides identities
- `cleaning_assignments.time_block` — 1-4 mapping to 2-hour windows (8:00-16:00)

## Important Conventions

- **Mexican localization**: Currency in MXN (centavos for Stripe), dates in DD/MM/YYYY, WhatsApp templates in es_MX, RFC field for tax ID
- **API versioning**: All endpoints under `/api/v1/`
- **Environment**: `ENVIRONMENT=development|production` controls docs visibility and error detail
- **Docker networking**: Services communicate on `maya-network`; n8n reached at `http://n8n:5678` from API container
- **Production domains**: `api.maya.app` (API), `automation.maya.app` (n8n), `dashboard.maya.app` (web) — routed via Traefik with Let's Encrypt TLS
