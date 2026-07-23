import {
  pgTable,
  pgEnum,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Localized text stored as jsonb keyed by locale: {"en": "...", "uk": "..."}.
 * The API resolves it to a plain string for the requested locale.
 */
export type LocalizedText = Partial<Record<string, string>>;

export const topicStatus = pgEnum("topic_status", [
  "draft",
  "syncing",
  "ready",
  "published",
  "disabled",
]);

export const gameStatus = pgEnum("game_status", [
  "draft",
  "pending_review",
  "unlisted",
  "published",
  "blocked",
]);

export const mechanic = pgEnum("mechanic", [
  "choice", // choice-image / choice-label via config.direction
  "swipe_binary",
  "higher_lower",
  "timeline_ribbon",
  "odd_one_out",
]);

export const importJobStatus = pgEnum("import_job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

/**
 * Top-level browse grouping: a CATEGORY holds several related datasets (topics)
 * and the games built on them. E.g. "Auto" = { car brands, car models }.
 * Catalog sorts by category; cross-dataset games live within one category.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("categories_sort_idx").on(t.sortOrder)],
);

/** A dataset of Wikidata entities + field mapping. Knows nothing about gameplay. */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    /** Browse grouping — datasets of one subject share a category. */
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>(),
    /** SPARQL preset / Wikidata classes / property mapping. */
    sourceConfig: jsonb("source_config").notNull(),
    /** Which fields entities of this topic carry (kind, role, wikidata prop). */
    fieldSchema: jsonb("field_schema").notNull(),
    /** Validation report from the last import: counts, coverage, unlocked mechanics. */
    validationReport: jsonb("validation_report"),
    status: topicStatus("status").notNull().default("draft"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("topics_status_idx").on(t.status),
    index("topics_category_idx").on(t.categoryId),
  ],
);

/** One Wikidata entity inside a topic. */
export const topicEntities = pgTable(
  "topic_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    wikidataQid: text("wikidata_qid").notNull(),
    /** {"en": "France", "uk": "Франція", ...} */
    labels: jsonb("labels").$type<LocalizedText>().notNull(),
    /** Numbers / dates / image URIs keyed by field role, e.g. {"flag": "...", "population": 68e6}. */
    values: jsonb("values").notNull(),
    imageUrl: text("image_url"),
    /** {author, license, sourceUrl} from Commons imageinfo. */
    imageCredit: jsonb("image_credit"),
    /** Per-language Wikipedia article URLs for attribution/explanations. */
    wikiLinks: jsonb("wiki_links").$type<LocalizedText>(),
    sitelinks: integer("sitelinks").notNull().default(0),
    pageviews: bigint("pageviews", { mode: "number" }).notNull().default(0),
    /** Popularity percentile within the topic (0..1). Drives difficulty tiers. */
    difficultyScore: doublePrecision("difficulty_score"),
    excluded: boolean("excluded").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("topic_entities_topic_qid_uq").on(t.topicId, t.wikidataQid),
    index("topic_entities_topic_idx").on(t.topicId),
  ],
);

/** A published combination: topic + mechanic + config + style. */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    mechanic: mechanic("mechanic").notNull(),
    /** direction, deckSize, difficulty tier, modifiers (blurReveal, blitz)… */
    config: jsonb("config").notNull().default({}),
    /** colors, cover, emoji… */
    style: jsonb("style").notNull().default({}),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    status: gameStatus("status").notNull().default("draft"),
    /** Set on rejection; shown in the creator cabinet. */
    reviewNote: text("review_note"),
    playsCount: integer("plays_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("games_status_idx").on(t.status),
    index("games_topic_idx").on(t.topicId),
  ],
);

/** A finished (or abandoned) play-through. Guests have userId = null. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    seed: text("seed").notNull(),
    score: integer("score").notNull().default(0),
    /** Per-card answers: [{cardId, entityId, correct, ms}] — feeds telemetry & collections. */
    answers: jsonb("answers").notNull().default([]),
    isDaily: boolean("is_daily").notNull().default(false),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_game_idx").on(t.gameId),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").references(() => topicEntities.id, {
      onDelete: "cascade",
    }),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_unresolved_idx").on(t.resolved)],
);

/** Chunked, resumable ingestion jobs (SPARQL → topic_entities). */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    status: importJobStatus("status").notNull().default("queued"),
    /** Resumable position: SPARQL offset / phase (entities|pageviews|images|report). */
    cursor: jsonb("cursor").notNull().default({}),
    log: jsonb("log").notNull().default([]),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("import_jobs_status_idx").on(t.status)],
);

/** Anti-garbage limits as DB config — tunable without a deploy. */
export const limits = pgTable("limits", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** "Challenge a friend": same deck via token, compare results. (Stage 2) */
export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  seed: text("seed").notNull(),
  authorSessionId: uuid("author_session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
