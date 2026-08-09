# Hosted deployment runbook

Status: prepared, not executed. No hosted Supabase or Vercel resources have been created by Codex.

## Release gate

Before linking any hosted project, run:

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm test:db
corepack pnpm build
```

Do not deploy if migrations have been edited after they were applied to a hosted database. After the first hosted push, every database change must be a new timestamped migration.

## 1. Create the private Supabase project

The user creates one Supabase project in the desired region and records these values privately:

- Project reference
- Database password, stored in a password manager
- Project URL
- Browser-safe publishable key (`sb_publishable_...`)

Do not copy a service-role or secret key into chat, source control, Vercel variables beginning with `NEXT_PUBLIC_`, or browser code.

In Authentication settings:

- Create or invite the single owner account.
- Keep public self-registration disabled after the owner exists.
- Use the final HTTPS Vercel URL as the Site URL.
- Add exact production redirect URLs. Add preview wildcards only if preview authentication is needed.

Supabase documents these settings in [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. Link and migrate

Run these only after verifying the project reference. They affect the linked hosted database:

```bash
corepack pnpm exec supabase login
corepack pnpm exec supabase link --project-ref <project-ref>
corepack pnpm exec supabase migration list
corepack pnpm exec supabase db push --dry-run
corepack pnpm exec supabase db push
corepack pnpm exec supabase migration list
```

Review the dry run before applying. Do not use `--include-seed` for production. Never use `supabase db reset --linked` on this project; it deletes hosted data. Supabase recommends migration-driven changes rather than editing production tables directly: [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows).

After migration, verify:

- All user-owned tables have RLS enabled.
- The owner can bootstrap a program cycle.
- A second test account cannot read the owner's records.
- Anonymous requests cannot execute private RPC functions.
- No service-role key is present in the frontend.

## 3. Create the Vercel project

Import the repository without deploying until variables are ready. Set these for Production and, only if desired, Preview:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=https://<final-vercel-or-custom-domain>
```

Vercel scopes variables separately to Production, Preview, and Development: [Environment variables](https://vercel.com/docs/environment-variables). Run `corepack pnpm verify:deployment` in an environment containing the production values before release.

Deploy, then update the Supabase Authentication Site URL and redirect settings to the final HTTPS domain if it changed.

## 4. Owner-account launch

1. Sign in through production `/login`.
2. Confirm unauthenticated visits redirect to `/login`.
3. Start a disposable Week 1 session, complete one set, and verify History after reload.
4. Confirm another browser can read the synchronized session only when signed into the owner account.
5. Disable public signup once the owner login is confirmed.

## 5. Free-tier backup routine

The in-app complete JSON export is the primary user-readable backup. Download it after each training week and keep at least two dated copies outside Supabase.

Also take periodic logical database dumps from the linked project and store them privately. Supabase recommends regular CLI exports and off-site copies for free-tier projects because paid backup guarantees differ: [Database backups](https://supabase.com/docs/guides/platform/backups).

Before cycle activation, major migrations, or account changes:

- Download a complete JSON export.
- Download the set-level CSV.
- Take a logical database dump.
- Confirm the files are non-empty.

## 6. Rollback boundaries

- Frontend regression: redeploy the previous known-good Vercel deployment.
- Additive database migration issue: create a forward-fix migration; do not edit an applied migration.
- Data corruption: stop writes, preserve exports/dumps, and diagnose before restoring.
- Lost connectivity: keep the workout open; IndexedDB/outbox state remains authoritative until sync succeeds.

A Vercel rollback does not roll back the database. Frontend and schema compatibility must be reviewed together.

## 7. Launch decision

Production is ready only after `plan/iphone-qa-checklist.md` passes. Stage 2 offline behavior must be tested by disabling connectivity during an active workout and observing Pending become Synced after reconnection.
