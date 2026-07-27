# Agent instructions — WiQus (wiki-quize)

Swipe-based quiz platform on live Wikipedia/Wikidata data.
Stack: **Next.js 16**, **React 19**, **TypeScript**, **Neon Postgres**, **Drizzle**, **Better Auth**, **next-intl**, **Tailwind CSS 4**.

Repo: `kolaedr/wiki-quize` · Docs: [`docs/PROJECT.md`](./docs/PROJECT.md) (EN) · Setup: [`docs/SETUP.md`](./docs/SETUP.md) (UA)

---

## ⛔ Agent operating rules (MUST follow — read first)

1. **Branching.** Create a **separate branch per task** and open the PR against **`dev`**. Do **not** commit directly on `dev` or `main`. **Never** merge into `main` — the user performs the `dev` → `main` merge themselves. Default base branch for every PR is `dev`.
2. **Seeds are opt-in and destructive.** Run `npm run db:seed` / `npm run db:seed:categories` **only** when the user explicitly asks. `db:seed` deletes & replaces `topic_entities` for the `countries`/`car-brands`/`car-models` slugs and overwrites `limits`, starter game configs, and category metadata — it will damage a real DB.
3. **Migrations require confirmation.** Before running `npm run db:migrate`, **ask the user first** and state in writing whether the pending migration is non-destructive (won't drop/alter existing data). Only run after they approve.

---

## Project layout

```
src/
  app/            Next.js App Router pages and API routes
  components/     UI, game boards, admin, social
  db/             schema.ts, auth-schema.ts, index.ts (lazy Neon client)
  i18n/           locale config + LocalizedText helpers
  lib/            auth, deck builder, ingest pipeline, admin actions
messages/         UI strings per locale (en.json, uk.json)
drizzle/          generated SQL migrations
scripts/          migrate.ts, seed.ts, seed-categories.ts
docs/             PROJECT.md + plan/ (UA roadmap)
```

---

## Conventions

- **Localized entity fields** are `jsonb` per locale (`{"en": "...", "uk": "..."}`). Resolve with `resolveText()` from `src/i18n/locales.ts`. UI copy goes through **next-intl** (`messages/*.json`).
- **Theme**: light / dark / system via `next-themes`; tokens in `globals.css` (`--bg`, `--fg`, `--accent`, …) → Tailwind classes like `bg-bg`, `text-fg`.
- **Game screens never scroll**: `.app-shell` is `100dvh`, `overflow: hidden`. Only catalog/settings/admin may scroll.
- **Commons images are hotlinked**, never stored. Allowed hosts: `upload.wikimedia.org`, `commons.wikimedia.org` (`next.config.ts`).
- **Minimize scope**: match existing patterns; do not refactor unrelated code.
- **Comments in code**: English only.

---

## Git workflow

| Branch | Role |
|---|---|
| `main` | Production |
| `dev` | Integration / staging |
| `features` | Agent integration branch (base for all agent work) |
| `features/<name>` | Optional sub-branch for a specific task |

**Before starting any work**

1. `git fetch origin`
2. Merge latest `origin/dev` into `features` (or into the current `features/*` sub-branch via `features`)
3. Skim recent commits on `dev` to see what changed

**While working**

- Branch from `features` — work directly on `features` or on a sub-branch like `features/my-task`
- Merge completed sub-branches back into `features` and push

**Pull requests**

- Do **not** open a PR to `dev` on your own
- Push finished work to `features`; open PR `features` → `dev` only when explicitly asked

---

## Local development

```bash
npm install
npm run db:migrate    # apply drizzle/ migrations (requires DATABASE_URL)
npm run dev           # http://localhost:3000
```

Optional seed data (38 countries + 26 car brands + 7 games):

```bash
npm run db:seed
```

Verify changes:

```bash
npm run lint
npm run build
```

Browse DB locally: `npm run db:studio`

---

## Environment variables

Set via Cursor Cloud **Secrets** (dashboard) or local `.env`. Never commit secrets.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string (`sslmode=require`) |
| `BETTER_AUTH_SECRET` | yes | min 32 chars — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | `http://localhost:3000` on Cloud VM; prod URL on Vercel |
| `ADMIN_EMAILS` | for admin | comma-separated emails allowed into `/admin` |
| `ADMIN_TASK_SECRET` | for import API | header `x-admin-secret` on `POST /api/admin/import` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth |

---

## Cursor Cloud specific instructions

Cloud agents run on an isolated Ubuntu VM. Configuration lives in [`.cursor/environment.json`](./.cursor/environment.json) and **Secrets** on [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents).

### First-time setup on Cloud

1. Ensure GitHub app is connected and this repo is granted access (see below).
2. Add Secrets in the dashboard (at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`).
3. Use a **dedicated dev Neon database** — do not point Cloud agents at production.
4. After `npm install`, run migrations once: `npm run db:migrate`.
5. Optional: `npm run db:seed` for playable demo content without Wikidata import.
6. Dev server starts via configured terminal: `npm run dev` → `http://localhost:3000`.

### Admin access on Cloud

1. Set `ADMIN_EMAILS` to a test email.
2. Register at `/auth` with that email.
3. Open `/admin` (shield icon also appears on the home page for admins).

### What NOT to do on Cloud

- Do **not** run long Wikidata imports (`/admin` sync or `POST /api/admin/import`) against a production database — imports can exceed serverless timeouts; use dev DB only.
- Do **not** commit `.env` files or secrets.
- Do **not** store Wikimedia images locally — hotlink only.

### Typical Cloud tasks

| Task | Commands / paths |
|---|---|
| UI feature | `src/components/`, `src/app/`, `messages/*.json` |
| Game logic | `src/lib/deck/`, `src/components/game/` |
| Admin | `src/components/admin/`, `src/lib/admin/` |
| Schema change | edit `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate` |
| Content ingest | `src/lib/ingest/`, presets in `src/lib/ingest/presets.ts` |

Always finish with `npm run lint` and `npm run build` before opening a PR.

### Known caveats

- `npm run lint` currently reports **pre-existing** errors (mostly `react-hooks/set-state-in-effect`, e.g. `src/lib/use-coarse-pointer.ts`, `src/components/theme-toggle.tsx`). They are unrelated to most tasks — focus on not adding *new* lint errors rather than a clean exit code.
- `next build` (Next 16) does **not** fail on those ESLint errors; a green build means TypeScript + compilation passed.
- `npm run db:migrate` is safe/idempotent (tracked migrations).
- **`npm run db:seed` is DESTRUCTIVE — do not run it against a database with real data.** It `DELETE`s and replaces all `topic_entities` for the `countries`, `car-brands`, and `car-models` topic slugs, overwrites the whole `limits` table with defaults, and upserts (overwrites `config`/`style`/`status`) the 10 starter game slugs. `npm run db:seed:categories` overwrites presentation metadata for its 55 category slugs. Only run these on a throwaway dev DB.
- `npm run db:seed` also validates every flag/logo image URL against Wikimedia before inserting (~1 min, network-bound); a built-in meta-guard trusts all URLs if validation looks rate-limited.

---

## GitHub integration (if repo is not visible in Cloud Agents)

Connect GitHub in Cursor, not in this repository:

1. Open [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations)
2. Click **Connect** next to **GitHub**
3. Install the [Cursor GitHub App](https://github.com/apps/cursor) and grant access to **`kolaedr/wiki-quize`** (or “All repositories”)
4. Confirm the same GitHub account is linked to your Cursor login
5. Return to [Cloud Agents → Environments](https://cursor.com/dashboard/cloud-agents#environments) — the repo should appear when creating an environment

If the repo is private, you must explicitly select it during GitHub app installation (“Selected repositories”).
