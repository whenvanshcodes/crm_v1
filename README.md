# Parlour CRM

Multi-tenant B2B venue management for snooker, gaming and recreational-resource businesses. The target stack is Next.js App Router, Supabase PostgreSQL and Supabase Auth.

## Local setup

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Create a Supabase project, add the three environment variables from `.env.example`, then run the SQL migration in `supabase/migrations/` through the Supabase SQL editor or CLI. The schema includes row-level security and tenant scopes. Seed users require corresponding Supabase Auth users and matching `profiles` rows.

## Commands

```sh
pnpm typecheck
pnpm test
pnpm build
```

## Security model

The browser uses only the Supabase public URL and anon key. Server route handlers derive the current identity from Supabase Auth, load its profile and resolve the venue server-side. RLS limits tenant tables to the resolved venue; `SUPER_ADMIN` is platform scoped and has no venue ID. Never place `SUPABASE_SERVICE_ROLE_KEY` in the browser.

## Migration note

`frontend/` and `backend/` are preserved legacy implementation references during this migration. The Java/Spring Boot backend is no longer the production runtime. The root Next.js app and `supabase/` are the active architecture.
