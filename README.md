# Workout Tracker

A private, mobile-first workout tracking PWA.

The approved product and technical plan is in [plan/implementation-plan.md](plan/implementation-plan.md).

## Local development

Prerequisites: Node.js 22+ and Corepack.

```bash
corepack pnpm install
corepack pnpm db:start
corepack pnpm dev
```

The app runs on `http://localhost:3001`; local Supabase Studio runs on `http://localhost:54323`.

Validation:

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm test:db
corepack pnpm build
```

Production builds use Next.js's supported webpack path for deterministic CI behavior; local development continues to use the default fast development bundler.

Copy `.env.example` to `.env.local` and use the URL and publishable key reported by `corepack pnpm exec supabase status`. Never put the reported secret key in a browser-exposed environment variable.

The workout interface is local-first. Active-session changes commit to IndexedDB and a durable outbox before foreground synchronization writes normalized records to Postgres. The service worker caches only the application shell and static assets; authenticated API responses and exports are not cached.

## Deployment

No hosted resources are provisioned automatically. Follow [the hosted deployment runbook](plan/deployment-runbook.md), then complete [the real-iPhone QA checklist](plan/iphone-qa-checklist.md). The browser bundle requires only the Supabase project URL and publishable key; it must never receive a service-role key.
