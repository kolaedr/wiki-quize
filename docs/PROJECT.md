# WikiQuiz — Project Documentation

*General implementation-facing documentation. v0.3 — 2026-07-22.*
*Working plan (Ukrainian) lives in [`docs/plan/`](./plan/).*

---

## 1. What we are building

A quiz-game **platform** built on live, validated Wikipedia/Wikidata data. Players play short (1–2 min) card sessions on mobile-first UI. Registered users can **create their own games**: pick a topic, import entities from Wikidata, pick a mechanic and style, publish. Facts are never hand-edited — every card links back to its Wikipedia article, which keeps content validated by construction and satisfies CC BY-SA attribution.

Inspiration: [history-in-cards](https://github.com/qWici/history-in-cards) — but generalized: multiple mechanics, any category, multilingual (EN base; UA, DE, ES, FR), and a live database instead of pre-generated static JSON.

## 2. Core abstraction: Topic × Mechanic = Game

Three independent concepts:

- **Topic (dataset)** — a set of Wikidata entities + field mapping. Example: topic "Countries" = country entities with fields `label (per-lang)`, `flag image`, `capital`, `population`, `area`, `continent`. A topic knows nothing about gameplay.
- **Mechanic** — a client component + answer logic that declares **which fields it requires**.
- **Game** — a published combination: `topic + mechanic + config` (question direction, deck size, difficulty tier, style/cover).

A topic automatically "unlocks" every mechanic whose field requirements are covered. Adding a new game = zero code. Adding a new mechanic = one React component + a requirements declaration.

### 2.1. Mechanics (initial set)

| Mechanic | Required fields | Example |
|---|---|---|
| `swipe-binary` | label + 1 comparable field | True/False statement, swipe right = true |
| `choice-image` | label + image | shows a name → pick 1 of 4 flags |
| `choice-label` | image + label | shows a flag → pick 1 of 4 names |
| `higher-lower` | label + numeric field | "Population of X higher than Y?" |
| `timeline-ribbon` | label + date | timeline ribbon: tap a slot → pick which entity belongs there |
| `odd-one-out` | label/image + 1 category field | grid of 3–4 cards; **swipe out** the one that doesn't belong (different class/continent/century) |

`choice-image` / `choice-label` are one mechanic with a `direction` config param.

**Relation questions (the generic "builder" shape).** A choice game is fully described by three picks: *(topic, answer field, direction)* — and the answer field may be an `entityRef` (a link to another entity), not just an own attribute. Example: topic **Car models** (`P31` car model) with field `brand` = manufacturer `P176` (entityRef: stores `{qid, labels}`):

- direction `entity → field`: show *Passat* → options are 4 brand labels/logos (1 correct + 3 sibling brands);
- direction `field → entity`: show *Audi* → options are 4 models, exactly one of which is Audi's; distractors are models of other brands (multi-valued rule: never include a second correct model).

The flag game is the same shape with an own attribute (`country → flag P41`), so the creation wizard needs no special cases: pick topic → pick answer field (own attribute or relation) → pick direction → the mechanic renders options as images or labels depending on the field kind.

**Card modifiers** — orthogonal to mechanics, toggled in game config:

- `blur-reveal`: the image starts blurred/zoomed and sharpens over a **visible countdown ring (timer)**; the earlier the answer, the more points. Applies to any image-based mechanic.
- `blitz`: per-card timer without blur.

### 2.2. Mechanic contract (TypeScript sketch)

```ts
type FieldKind = 'label' | 'image' | 'number' | 'date' | 'entityRef';

interface MechanicSpec {
  id: string;                       // 'choice-image'
  requires: { kind: FieldKind; role: string }[];  // declared field needs
  minEntities: number;              // anti-garbage floor, see §8
  buildDeck(entities: Entity[], cfg: GameConfig, seed: string): Card[];
  Component: React.FC<{ card: Card; onAnswer(a: Answer): void }>;
}

interface Card {
  id: string;
  entityId: string;
  prompt: LocalizedText;            // from lang-specific question templates
  payload: unknown;                 // mechanic-specific (options, ribbon slots…)
  correct: Answer;
  explain: { text: LocalizedText; wikiUrl: string; image?: ImageRef };
}
```

Deck building is **server-side** (seeded, cacheable); the component only renders and collects answers. Shared contract: `deck in → answers out`.

### 2.3. Distractor rules

Wrong options must be **plausible**: sibling entities from the same topic, close in value (dates shifted within a sane window, numeric neighbors, adjacent occupations). Comparative questions require a minimum gap so answers are never debatable: value difference ≥ 15%, date gap ≥ 5 years (per-mechanic config).

**Multi-valued facts rule**: when a fact maps to several correct entities (e.g. French is official in many countries), the distractor set must exclude *all* correct answers; if the fact is too ambiguous (correct set larger than a per-mechanic threshold, e.g. > 5 countries for a language), the entity is skipped for that mechanic entirely.

### 2.4. Launch content (Stage 1 starter games)

Two curated topics, five games — all covered by the `choice-image`/`choice-label` mechanic:

| # | Game | Topic | Fields (Wikidata) |
|---|---|---|---|
| 1 | Flag → Country / Country → Flag | Countries | flag `P41` |
| 2 | Coat of arms → Country | Countries | coat of arms `P237` |
| 3 | Language ↔ Country | Countries | official language `P37` (multi-valued rule applies) |
| 4 | Car brand ↔ Logo | Car brands | logo `P154` |
| 5 | Car brand → Country of origin | Car brands | country of origin `P495` / `P17` |

Topic **Countries**: `P31 Q6256` — label, flag, coat of arms, official languages, capital, population, area, continent. Topic **Car brands**: automobile manufacturers/brands — label, logo, country of origin, inception date. Countries are the flagship topic (players literally learn flags/arms/languages); car brands validate that the platform works beyond geography.

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** on Vercel | one deployment: frontend + API + crons; ingestion is TS in the same repo (no Python) |
| Database | **Neon Postgres** (Vercel Marketplace) | Vercel Postgres is sunset; Neon is the successor; serverless, free tier, branching |
| ORM | **Drizzle** (+ drizzle-kit migrations) | lightweight, serverless-friendly; Drizzle Studio for local data inspection |
| Auth | **Better Auth** | email+password & OAuth (Google/GitHub), roles, schema lives in our Postgres |
| State / UI | zustand, Tailwind, shadcn/ui (admin), `next-intl` (i18n) | |
| Swipe/animation | **motion** (framer-motion) drag + fling physics | NOT Swiper.js (that's a carousel lib) |
| Ingestion jobs | Vercel Cron + route handlers, chunked with cursor | serverless time limits → resumable jobs |
| Caching | `unstable_cache` / ISR + CDN | game reads never hit Wikimedia; decks cached |

## 4. Data model (draft)

```
users            id, email, name, role (user|admin), created_at
topics           id, slug, title(jsonb per-lang), source_config(jsonb: SPARQL preset / classes / props),
                 field_schema(jsonb), status(draft|syncing|ready|published|disabled),
                 owner_id → users, sync_at
topic_entities   id, topic_id, wikidata_qid, labels(jsonb), values(jsonb: numbers/dates/uris),
                 image_url, image_credit(jsonb), wiki_links(jsonb per-lang),
                 sitelinks, pageviews, difficulty_score, excluded(bool)
games            id, topic_id, mechanic(enum), config(jsonb), style(jsonb), title(jsonb),
                 owner_id, status(draft|pending_review|unlisted|published|blocked), plays_count
sessions         id, game_id, user_id?, seed, score, answers(jsonb), finished_at
reports          id, entity_id?, game_id?, reason, user_id?, created_at, resolved
import_jobs      id, topic_id, status, progress/cursor, log(jsonb), started_at
limits           key, value                -- anti-garbage limits as DB config, tunable w/o deploy
```

`difficulty_score` = popularity percentile of the entity within its topic (sitelinks + pageviews). Gives difficulty tiers for free; for numeric mechanics difficulty also = closeness of compared values.

**Related topics**: computed from shared Wikidata classes (P31/P279) and property overlap → "similar games" recommendations and cross-topic decks (later stage).

## 5. Data ingestion (all TypeScript, server-side)

1. Creator defines a source: Wikidata class search (autocomplete via `wbsearchentities`) or a curated preset (countries, cities, paintings, films…).
2. A route handler enqueues an `import_job`; cron/background function processes it in **chunks** (200–500 entities per SPARQL page), normalizes, upserts into `topic_entities`, stores a cursor and resumes on the next tick.
3. Quality filters: `sitelinks ≥ N`, pageviews threshold (last 12 months), labels present in **all active languages**, mechanic-required fields present, date precision ≥ year, "preferred" rank when multiple statement values, no future dates, dedup.
4. On completion — a **validation report**: entity count, per-field & per-language coverage, unlocked mechanics list. Shown to the creator and to the admin review queue.
5. Topics re-sync via cron every 1–2 weeks (picks up wiki fixes).

Wikimedia APIs used (all free, no keys; custom User-Agent, throttled, server-side only):

| API | Purpose |
|---|---|
| Wikidata SPARQL (`query.wikidata.org/sparql`) | entity selection by class + properties + labels in all languages in one query |
| Wikipedia REST (`{lang}.wikipedia.org/api/rest_v1/page/summary/{title}`) | explanation text + thumbnail per language |
| Pageviews API (`wikimedia.org/api/rest_v1/metrics/pageviews/...`) | popularity filter / difficulty score |
| MediaWiki Action API (`{lang}.wikipedia.org/w/api.php`) | fallback batch extracts, `wbsearchentities`, `imageinfo` (image license/credit) |

Images are **never stored** — hotlinked Commons thumbnails (~320px) + stored credit metadata.

## 6. Users, guest flow, creator cabinet

Roles: **guest** (plays without registration), **registered user** (player + creator in one), **admin**.

- **Guest**: full play access; progress in localStorage/IndexedDB. After the *first finished game*, a soft non-blocking prompt on the result screen: "Sign up to save results, share, and create your own games". Dismissible, not repeated. On signup, local results **migrate into the account**.
- **Cabinet**, two tabs: *My progress* (results, streaks, daily history, favorites) and *My games* (created games with statuses `draft → pending_review → unlisted/published`, per-game validation report, rejection reason if any, actions: edit style, review topic entities / exclude, submit for review).
- Creators **cannot edit facts** — only exclude entities and configure presentation. Every card links to its Wikipedia article.

### Game creation wizard

```
Topic:  pick existing ─────────────────────────────┐
        or create new → source → import → report ──┤
                                                   ▼
Mechanic: list of unlocked mechanics + question direction
                                                   ▼
Config & style: title, difficulty, colors/cover, deck size (within limits)
                                                   ▼
Preview: play it yourself → submit for review (pending_review)
```

## 7. Moderation: fast review queue

Submitted games become `pending_review` and are playable as `unlisted` via direct link (creator can share & test before approval). Admin queue is optimized for speed — one page per game: **embedded playable preview** (same game view), topic validation report, a flat sample of 20 random cards (eyeball scan without playing), creator history (publications / rejections / reports). Actions: Approve → `published` / Keep unlisted / Reject with templated reason (visible in creator cabinet). Target: ≤ 1 min per game on an already-reviewed topic; the *topic* is the main review object — games on top of approved topics are near-auto-approved.

## 8. Anti-garbage limits (system-level, not moderation-level)

Stored in the `limits` DB table, tunable without deploy. Starting values:

| What | Limit |
|---|---|
| Deck size per session | 7–20 cards (default 10) |
| Min topic size per mechanic | choice: ≥ 40 entities (non-repeating distractors), swipe/higher-lower: ≥ 30, timeline: ≥ 50 |
| Max topic size | ≤ 5000 entities |
| Active topics per creator | 3 (grows with good publication history) |
| Games per creator | 10; max 3 simultaneously in review |
| Imports per creator per day | 5 |
| Duplicates | same topic+mechanic+direction as an existing catalog game → blocked, existing game suggested |

## 9. Client & UX

- **Game screen = one viewport.** App shell at `100dvh`, `overflow: hidden`, safe-area insets. No scrolling during gameplay; scroll exists only in catalog/settings/cabinet.
- Swipe: `motion` drag with thresholds + fling physics + card stack (next card peeking underneath). ~100 lines of owned code, full control of feel.
- Buttons duplicating swipe directions + arrow keys (desktop, accessibility).
- Instant feedback after each answer: correct answer + one-line explanation + Wikipedia link (the "rabbit hole" retention hook).
- Session: 7–20 cards, 3 lives, streak multiplier, optional blitz timer. **Daily deck**: date-seeded, identical worldwide, Wordle-style share.
- **PWA-first is a product decision, from Stage 1**: installable manifest, service worker, played-deck caching so an active game survives network loss. No native apps at launch — App Store / Play Store rules and review cycles are not worth it until there is traction; Capacitor wrappers are a Stage 3 "only if needed" item.

## 9a. Engagement & retention features

- **Collections.** Every correctly answered entity is "unlocked" into the player's personal encyclopedia-album with per-topic coverage ("Flags 62/195"). Progress bars drive return visits; unlocked entries link to Wikipedia. Cheap: an aggregate over `sessions.answers`.
- **Mistakes deck (spaced repetition).** Failed cards return after 1 day / 1 week as a "Review" deck. Turns the game into a learning tool and bridges to the education audience.
- **Challenge link.** After a game: "challenge a friend" → share URL with a token (`challenge_id` = game + seed + author result). Friend plays the same deck, result screen shows the comparison. No realtime needed — a token and one result row.
- **"On this day".** Auto-generated daily deck from Wikidata date properties ("events of July 22") — zero curation, pairs well with the daily challenge and push/share hooks.
- **Card quality telemetry (auto-flag).** Aggregate per-card correctness from `sessions.answers`: ~50% → ambiguous (coin-flip), ~99% → trivial; both tails go to the admin review queue automatically. Complements player reports with zero player effort.
- **Audio cards (later / design stage).** Wikidata has audio properties (anthems, bird songs `P51`, pronunciations) hosted on Commons. "Whose anthem is this?" is a differentiator, but: media handling, CORS, iOS autoplay policies — and we do **not** store audio, only hotlink Commons files. Kept as a design-first item in Stage 3: prototype playback + measure data coverage before committing.

## 9b. Teacher mode (Stage 3, high-interest)

Private classroom groups: a teacher creates a group, assigns decks, sees per-student results. Two content sources:

1. **Wiki-generated decks** (standard platform flow — teacher can only exclude entities), and
2. **Custom teacher decks** — the teacher authors their own questions/cards. This is the *one deliberate exception* to the "facts are immutable" principle, and it is scoped hard: custom decks exist **only inside private groups**, never in the public catalog, never in search, clearly labeled "teacher content, not wiki-verified". The public platform's validity guarantee stays intact.

Requires: groups/membership model, assignment + results screens, minors-privacy care (no public profiles for students). Explicitly out of scope until Stage 3.

## 10. i18n

- Entity data (labels, descriptions) comes from Wikidata/Wikipedia in each language — no machine translation. An entity enters the game pool only if covered in **all active languages** → decks are identical across languages, daily challenge is globally fair. This doubles as a quality filter.
- Question templates are hand-localized per language (`templates/{lang}.json`, placeholder-based) — written per language, not translated literally (cases, articles).
- UI via `next-intl`. Language rollout: EN → UA → DE/ES/FR (new language = template + UI translation; data is already there).

## 11. Licensing

- **Wikidata — CC0**: facts free to use, no attribution needed.
- **Wikipedia text — CC BY-SA 4.0**: explanation snippets require attribution → the per-card Wikipedia link covers it; add an "About the data" page.
- **Commons images**: varied licenses; store author+license from `imageinfo` and show credit on image tap.

## 12. Risks

| Risk | Mitigation |
|---|---|
| UGC garbage in catalog | system-level limits (§8) + review queue (§7); facts immutable by construction |
| Serverless timeouts on large imports | chunked resumable jobs + cron; topic size cap |
| Debatable/imprecise facts | precision/rank filters at ingest; min value/date gaps; player reports; N reports → auto-exclude pending review |
| Poor non-EN label coverage | label requirement at ingest; coverage metric in validation report |
| Cold DB / cost | Neon free tier + aggressive CDN deck caching; game reads never hit DB directly |
| Wikidata vandalism | high-sitelinks entities only; bi-weekly re-sync picks up fixes; reports |

## 13. Roadmap (summary)

Detailed per-stage task breakdown: [`docs/plan/`](./plan/).

- **Stage 1 — Core (no UGC)**: scaffold, DB, auth, PWA basics, ingestion with curated topics **Countries + Car brands**, the 5 starter games (§2.4) on `choice-image`/`choice-label`, plus `swipe-binary` and `higher-lower`, no-scroll game screen, admin: topics + jobs.
- **Stage 2 — Platform**: `timeline-ribbon`, `odd-one-out`, blur-reveal modifier, collections, mistakes deck, challenge link, "on this day", quality telemetry, user cabinet, guest→signup migration, creation wizard, review queue, limits, reports, daily challenge + share, UA locale.
- **Stage 3 — Growth**: DE/ES/FR, related topics & recommendations, adaptive difficulty, leaderboards, seed-based duels, teacher mode (§9b), audio cards (design-first), native wrappers (Capacitor) only if traction.
