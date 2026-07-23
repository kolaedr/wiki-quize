import { and, eq, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { filterWorkingUrls } from "@/lib/validate-urls";
import { sparqlQuery } from "@/lib/wikidata/sparql";
import { PRESETS, type RawEntity } from "./presets";

export interface StarterGame {
  slug: string;
  title: Record<string, string>;
  icon: string;
  mechanic: "choice" | "higher_lower" | "swipe_binary";
  /** merged into games.config next to deckSize/perLevel/levels */
  config: Record<string, unknown>;
  /** role used to count entities for level math */
  countRole?: string;
}

export const STARTER_GAMES: Record<string, StarterGame[]> = {
  countries: [
    {
      slug: "flags",
      title: { en: "Flags of the World", uk: "Прапори світу" },
      icon: "flag",
      mechanic: "choice",
      config: { answerRole: "flag", singleTmpl: "isFlag" },
      countRole: "flag",
    },
    {
      slug: "coat-of-arms",
      title: { en: "Coats of Arms", uk: "Герби країн" },
      icon: "shield",
      mechanic: "choice",
      config: { answerRole: "arms", singleTmpl: "isArms" },
      countRole: "arms",
    },
    {
      slug: "country-languages",
      title: { en: "Language & Country", uk: "Мова і країна" },
      icon: "languages",
      mechanic: "choice",
      config: { refRole: "languages", singleTmpl: "langOf" },
      countRole: "languages",
    },
    {
      slug: "population-duel",
      title: { en: "Higher: Population", uk: "Більше: населення" },
      icon: "users",
      mechanic: "higher_lower",
      config: { valueRole: "population", tmpl: "morePopulation", imageRole: "flag" },
      countRole: "population",
    },
    {
      slug: "true-false-countries",
      title: { en: "True or False: Countries", uk: "Правда чи ні: країни" },
      icon: "scale",
      mechanic: "swipe_binary",
      config: {
        roles: [
          { role: "population", tmpl: "popHigher" },
          { role: "area", tmpl: "areaHigher" },
        ],
      },
      countRole: "population",
    },
  ],
  "car-brands": [
    {
      slug: "car-logos",
      title: { en: "Car Logos", uk: "Логотипи авто" },
      icon: "car",
      mechanic: "choice",
      config: { answerRole: "logo", singleTmpl: "isLogo" },
      countRole: "logo",
    },
    {
      slug: "car-origin",
      title: { en: "Car Brand Origins", uk: "Звідки бренд авто" },
      icon: "globe",
      mechanic: "choice",
      config: { refRole: "originCountries", promptImageRole: "logo", singleTmpl: "brandFrom" },
      countRole: "originCountries",
    },
  ],
};

export interface ValidationReport {
  fetched: number;
  accepted: number;
  droppedNoLabels: number;
  droppedMissingRequired: number;
  brokenImages: number;
  fieldCoverage: Record<string, number>;
  finishedAt: string;
}

/**
 * Full import of a preset topic (small topics fit one invocation;
 * chunked/cursor mode is a stage-1 TODO for user-created topics).
 *
 * SAFETY RULES (learned in prod):
 * - a PUBLISHED topic never leaves "published" during a re-sync — the catalog
 *   must not blink or lose games while a job runs or fails;
 * - entities are UPSERTED (no delete-all window); stale rows are removed only
 *   AFTER a successful write, and never if the fetch came back suspiciously small.
 */
export async function runImport(presetKey: string): Promise<ValidationReport> {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

  // Upsert the topic shell; DO NOT touch the status of an existing topic.
  const [topic] = await db
    .insert(topics)
    .values({
      slug: preset.slug,
      title: preset.title,
      sourceConfig: { preset: preset.key, icon: preset.icon },
      fieldSchema: preset.fieldSchema,
      status: "syncing", // first-ever import only (row didn't exist yet)
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { sourceConfig: { preset: preset.key, icon: preset.icon } },
    })
    .returning();

  // A previous run may have been killed by the serverless time limit —
  // mark its jobs failed so the admin panel doesn't show them "running" forever.
  await db
    .update(importJobs)
    .set({ status: "failed", finishedAt: new Date(), log: ["superseded by a new run"] })
    .where(and(eq(importJobs.topicId, topic.id), eq(importJobs.status, "running")));

  const [job] = await db
    .insert(importJobs)
    .values({ topicId: topic.id, status: "running", startedAt: new Date() })
    .returning();

  try {
    const rows = await sparqlQuery(preset.query);

    let droppedNoLabels = 0;
    let droppedMissingRequired = 0;
    const seen = new Set<string>();
    const entities: RawEntity[] = [];

    for (const row of rows) {
      const e = preset.normalize(row);
      if (!e || seen.has(e.qid)) continue;
      seen.add(e.qid);

      // Quality filter 1: labels in ALL active locales (also a quality signal)
      if (!ACTIVE_LOCALES.every((l) => e.labels[l])) {
        droppedNoLabels++;
        continue;
      }
      // Quality filter 2: mechanic-required fields present
      const missing = preset.requiredRoles.some((r) => {
        const v = e.values[r];
        return v == null || (Array.isArray(v) && v.length === 0);
      });
      if (missing) {
        droppedMissingRequired++;
        continue;
      }
      entities.push(e);
    }

    // Quality filter 3: image URL availability — no fake/broken images in games.
    // Checks every image-kind field value; broken URLs are dropped from the
    // entity, and entities that lose a REQUIRED image role are dropped fully.
    const imageRoles = preset.fieldSchema
      .filter((f) => f.kind === "image")
      .map((f) => f.role);
    const allImageUrls = entities.flatMap((e) =>
      imageRoles.map((r) => e.values[r] as string | undefined),
    );
    const okUrls = await filterWorkingUrls(allImageUrls, 10);
    let brokenImages = 0;
    for (const e of entities) {
      for (const r of imageRoles) {
        const u = e.values[r] as string | undefined;
        if (u && !okUrls.has(u)) {
          e.values[r] = undefined;
          if (e.imageUrl === u) e.imageUrl = undefined;
          brokenImages++;
        }
      }
    }
    const validated = entities.filter(
      (e) =>
        !preset.requiredRoles.some((r) => {
          const v = e.values[r];
          return v == null || (Array.isArray(v) && v.length === 0);
        }),
    );
    entities.length = 0;
    entities.push(...validated);

    // Sanity guard: a suspiciously small result (SPARQL hiccup, endpoint
    // change) must NOT overwrite a healthy dataset.
    if (entities.length < 10) {
      throw new Error(
        `sanity guard: only ${entities.length} entities passed filters — keeping existing data`,
      );
    }

    // Difficulty = popularity percentile within the topic (1 = most famous)
    const sorted = [...entities].sort((a, b) => b.sitelinks - a.sitelinks);
    const rank = new Map(sorted.map((e, i) => [e.qid, 1 - i / Math.max(1, sorted.length - 1)]));

    // UPSERT (no delete-all window): existing rows are updated in place,
    // `excluded` flags survive; stale rows are removed only after success.
    const CHUNK = 100;
    for (let i = 0; i < entities.length; i += CHUNK) {
      await db
        .insert(topicEntities)
        .values(
          entities.slice(i, i + CHUNK).map((e) => ({
            topicId: topic.id,
            wikidataQid: e.qid,
            labels: e.labels,
            values: e.values,
            imageUrl: e.imageUrl,
            wikiLinks: e.wikiLinks,
            sitelinks: e.sitelinks,
            difficultyScore: rank.get(e.qid) ?? 0,
          })),
        )
        .onConflictDoUpdate({
          target: [topicEntities.topicId, topicEntities.wikidataQid],
          set: {
            labels: sql`excluded.labels`,
            values: sql`excluded.values`,
            imageUrl: sql`excluded.image_url`,
            wikiLinks: sql`excluded.wiki_links`,
            sitelinks: sql`excluded.sitelinks`,
            difficultyScore: sql`excluded.difficulty_score`,
            updatedAt: sql`now()`,
          },
        });
    }

    // Remove rows that disappeared from the source — only now, after the
    // new data is fully written.
    await db
      .delete(topicEntities)
      .where(
        and(
          eq(topicEntities.topicId, topic.id),
          notInArray(topicEntities.wikidataQid, entities.map((e) => e.qid)),
        ),
      );

    const fieldCoverage: Record<string, number> = {};
    for (const f of preset.fieldSchema) {
      fieldCoverage[f.role] = entities.filter((e) => {
        const v = e.values[f.role];
        return v != null && (!Array.isArray(v) || v.length > 0);
      }).length;
    }

    const report: ValidationReport = {
      fetched: rows.length,
      accepted: entities.length,
      droppedNoLabels,
      droppedMissingRequired,
      brokenImages,
      fieldCoverage,
      finishedAt: new Date().toISOString(),
    };

    await db
      .update(topics)
      .set({ status: "published", syncedAt: new Date(), validationReport: report })
      .where(eq(topics.id, topic.id));

    // Auto-create starter games for this preset (published; idempotent by slug).
    // Difficulty progression: entities are ranked famous → obscure; each game
    // splits them into levels of `perLevel` items (level 1 = the best-known).
    // Games needing labels of RELATED entities (languages, origin countries)
    // wait for the reference-label enrichment pass — see stage-1 checklist.
    const PER_LEVEL = 20;
    const MIN_PUBLISHABLE_ITEMS = 8;
    for (const g of STARTER_GAMES[preset.key] ?? []) {
      const withRole = g.countRole
        ? entities.filter((e) => {
            const v = e.values[g.countRole!];
            return v != null && (!Array.isArray(v) || v.length > 0);
          }).length
        : entities.length;
      const config = {
        ...g.config,
        deckSize: 10,
        perLevel: PER_LEVEL,
        levels: Math.max(1, Math.ceil(withRole / PER_LEVEL)),
      };
      // Too few playable items → keep out of the catalog (would 404)
      const status = withRole >= MIN_PUBLISHABLE_ITEMS ? "published" : "unlisted";
      await db
        .insert(games)
        .values({
          slug: g.slug,
          topicId: topic.id,
          mechanic: g.mechanic,
          config,
          style: { icon: g.icon },
          title: g.title,
          status,
        })
        .onConflictDoUpdate({
          target: games.slug,
          set: { topicId: topic.id, status, config },
        });
    }
    await db
      .update(importJobs)
      .set({
        status: "done",
        finishedAt: new Date(),
        log: sql`${JSON.stringify([report])}::jsonb`,
      })
      .where(eq(importJobs.id, job.id));

    return report;
  } catch (err) {
    await db
      .update(importJobs)
      .set({
        status: "failed",
        finishedAt: new Date(),
        log: sql`${JSON.stringify([String(err)])}::jsonb`,
      })
      .where(eq(importJobs.id, job.id));
    // NEVER unpublish on failure — existing data keeps serving the catalog.
    throw err;
  }
}

/** Housekeeping: any job "running" longer than 15 min was killed → failed. */
export async function failStaleJobs() {
  await db
    .update(importJobs)
    .set({ status: "failed", finishedAt: new Date(), log: ["stale: exceeded 15min"] })
    .where(
      and(
        eq(importJobs.status, "running"),
        lt(importJobs.startedAt, new Date(Date.now() - 15 * 60_000)),
      ),
    );
}
