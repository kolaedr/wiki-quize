# WikiQuize

Swipe-based quiz platform built on live Wikipedia/Wikidata data.
Mobile-first PWA · Next.js · Neon Postgres · Drizzle · Better Auth.

Full documentation: [`docs/PROJECT.md`](./docs/PROJECT.md) (EN) · work plan: [`docs/plan/`](./docs/plan/) (UA).

## Setup

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run db:migrate          # apply migrations to your Neon database
npm run dev                 # http://localhost:3000
```

### Environment

| Var | Where to get it |
|---|---|
| `DATABASE_URL` | Vercel dashboard → Storage → Neon (pooled connection string), or neon.tech directly |
| `BETTER_AUTH_SECRET` | `npx @better-auth/cli secret` or `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally; your prod URL on Vercel |
| `GOOGLE_CLIENT_ID/SECRET` | optional — Google OAuth (redirect: `{URL}/api/auth/callback/google`) |

## Scripts

| Script | What |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run db:generate` | generate SQL migration from `src/db/*.ts` schema changes |
| `npm run db:migrate` | apply migrations |
| `npm run db:studio` | Drizzle Studio (local DB browser) |

## Structure

```
src/
  app/            pages, API routes (auth at /api/auth/[...all]), manifest
  components/     theme-provider, theme-toggle, (mechanics → soon)
  db/             schema.ts (app tables), auth-schema.ts (Better Auth), index.ts (lazy Neon client)
  i18n/           locale config + LocalizedText resolver
  lib/            auth.ts (server), auth-client.ts (react)
messages/         UI strings per locale (next-intl)
drizzle/          generated SQL migrations
docs/             PROJECT.md (EN) + plan/ (UA)
```

## Conventions

- **All entity/topic/game text fields are `jsonb` per-locale** (`{"en": "...", "uk": "..."}`); resolve with `resolveText()` from `src/i18n/locales.ts`. UI strings go through next-intl.
- **Theme**: light / dark / system via `next-themes` (class strategy); design tokens live in `globals.css` (`--bg`, `--fg`, `--accent`, …) and map to Tailwind as `bg-bg`, `text-fg`, `text-accent`, etc.
- **Game screens never scroll**: use the `.app-shell` (100dvh, overflow hidden); scrollable areas must opt in explicitly.
- Commons images are hotlinked (never stored) — allowed hosts are configured in `next.config.ts`.
