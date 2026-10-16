# TAITIT Configurador

Eyewear customization app for TAITIT Eyewear: browse the collection, customize each frame zone (metal / acetate) and send an order request.

## Structure

```
app/          Expo React Native app (Android + iOS), Expo Router
admin/        Admin panel: React + Vite + Tailwind + React Router + TanStack Query
shared/       Types, business rules and design tokens used by app and admin (TypeScript source)
supabase/     Database migrations, seed and Edge Functions
tools/zones/  Internal tool: product photo → base image + zone layers
docs/         Milestone plan, daily plan and project docs
```

## Requirements

- Node 24 (see `.nvmrc`), npm 11
- Expo Go or a development build to run the app on a device
- Supabase CLI via `npx supabase` (Docker only needed for a local database)

## Setup

```bash
npm install                      # installs all workspaces
cp app/.env.example app/.env     # fill in Supabase URL + publishable key
cp admin/.env.example admin/.env
```

## Commands

```bash
npm run dev:app        # Expo dev server
npm run dev:admin      # admin panel on http://localhost:5173
npm run typecheck      # all workspaces
npm run lint           # all workspaces
npm run format         # Prettier
npm run test:db        # database security + constraint tests (linked Supabase project)
npm run db:types       # regenerate shared/src/database.types.ts after schema changes
```

## Database

- Schema, RLS and storage rules: `supabase/migrations/`. Apply with `npx supabase db push` (add `--include-seed` on a fresh project for the placeholder palettes).
- Tests: `supabase/tests/rls_and_constraints.sql` acts as guest, two customers and an admin, and always rolls back, so it leaves no data behind.
- Make a user admin (manual by design): `update public.profiles set role = 'admin' where email = '...';` in the Supabase SQL editor.

## Notes

- React is pinned to the version required by Expo (root `overrides`) so the app, admin and shared code use a single copy.
- `shared` is consumed as TypeScript source; no build step.
- Never commit `.env` files, signing keys or service-role keys.
