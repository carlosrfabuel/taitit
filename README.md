# TAITIT Configurador

Eyewear customization app for TAITIT Eyewear: opticians browse the collection, customize each frame part (metal / acetate colors, finish, customizing form), put several frames in a cart and send them as one order. TAITIT manages models, colors, opticians and orders in the admin panel.

## Structure

```
app/          Expo React Native app (Android + iOS), Expo Router
admin/        Admin panel: React + Vite + Tailwind + React Router + TanStack Query
shared/       Types, business rules and design tokens used by app and admin (TypeScript source)
supabase/     Database migrations, seed and Edge Functions
tools/zones/  Internal tool: product photo → base image + zone layers (adding models)
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

## Services

- **Supabase**: database, login, file storage (model images, textures, order images). Project URL and
  publishable key go in `app/.env` and `admin/.env`.
- **Vercel**: hosts the admin panel (https://taitit-admin.vercel.app). Settings in `vercel.json`.
- **Expo (EAS)**: builds the Android APK / store app and the iOS app. Project settings in `app/app.json`
  (`owner`, `extra.eas.projectId`) and `app/eas.json`.

## Deploying the admin panel

```bash
npx vercel deploy --prod      # from this folder, with access to the Vercel project
```

The build runs `npm run build -w admin` and serves `admin/dist`. The Supabase values are set as
environment variables in the Vercel project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`).

## Building the app

```bash
cd app
npx eas-cli build -p android --profile preview      # installable APK for testing
npx eas-cli build -p android --profile production   # Google Play (app bundle)
npx eas-cli build -p ios --profile production       # App Store (needs an Apple developer account)
```

The Supabase values come from the EAS project's environment variables (`EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_KEY`, set for the `preview` and `production` environments). The Android signing
key is kept by EAS (remote credentials); keep using the same one, or installed apps can't be updated.

## Database

- Schema, RLS and storage rules: `supabase/migrations/`. Link once with `npx supabase link --project-ref <ref>`, then apply new migrations with `npx supabase db push` (add `--include-seed` on a fresh project for the placeholder palettes).
- After a schema change: `npm run db:types`, then `npm run typecheck`.
- Orders are placed only through the database functions (`create_order_lines`; `create_order` for app versions before the cart), which check every frame on the server.
- Tests: `supabase/tests/rls_and_constraints.sql` acts as guest, two customers and an admin, and always rolls back, so it leaves no data behind.
- Make a user admin (manual by design): `update public.profiles set role = 'admin' where email = '...';` in the Supabase SQL editor.

## Adding a model

Models are prepared with the zone tool, not in the admin panel: see `tools/zones/README.md`. Once
uploaded, the model appears in the admin panel (hidden), where names, colors and defaults can be
changed and the model published.

## Notes

- React is pinned to the version required by Expo (root `overrides`) so the app, admin and shared code use a single copy.
- `shared` is consumed as TypeScript source; no build step.
- Never commit `.env` files, signing keys or service-role keys.
