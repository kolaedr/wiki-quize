import { and, eq, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { filterWorkingUrls } from "@/lib/validate-urls";
import { qidFromUri, sparqlQuery } from "@/lib/wikidata/sparql";
import {
  autoGamesFor,
  buildTopicQuery,
  normalizeDefRow,
  type TopicDef,
} from "./def";
import { countForClass } from "./probe";
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

/** A game below this many playable items may not be published (would 404). */
export const MIN_PUBLISHABLE_ITEMS = 8;

export interface ValidationReport {
  fetched: number;
  accepted: number;
  /** how many items of the class exist at the threshold (def topics only) */
  totalExisting?: number;
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
  // Not a code preset? Then it must be a NO-CODE topic: definition lives in DB.
  let def: TopicDef | null = null;
  if (!preset) {
    const [t] = await db.select().from(topics).where(eq(topics.slug, presetKey)).limit(1);
    def = ((t?.sourceConfig as { def?: TopicDef } | null)?.def as TopicDef) ?? null;
    if (!def) throw new Error(`Unknown preset/topic: ${presetKey}`);
  }

  const slug = preset?.slug ?? def!.slug;
  const title = preset?.title ?? def!.title;
  const icon = preset?.icon ?? def!.icon;
  const fieldSchema =
    preset?.fieldSchema ??
    def!.fields.map((f) => ({ role: f.role, kind: f.kind, wikidataProp: f.prop }));
  const requiredRoles =
    preset?.requiredRoles ?? def!.fields.filter((f) => f.required).map((f) => f.role);
  const sourceConfig = preset
    ? { preset: preset.key, icon }
    : { def: def!, icon };

  // Upsert the topic shell; DO NOT touch the status of an existing topic.
  const [topic] = await db
    .insert(topics)
    .values({
      slug,
      title,
      sourceConfig,
      fieldSchema,
      status: "syncing", // first-ever import only (row didn't exist yet)
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { sourceConfig },
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
    // "X of Y existing": how many items the class has at this threshold —
    // makes the seed-vs-live gap visible in the admin panel (pipeline v2).
    const totalExisting = def
      ? await countForClass(def.classQids, def.sitelinksMin).catch(() => undefined)
      : undefined;

    const rows = await sparqlQuery(
      preset ? preset.query : buildTopicQuery(def!, ACTIVE_LOCALES),
    );

    let droppedNoLabels = 0;
    let droppedMissingRequired = 0;
    const seen = new Set<string>();
    const entities: RawEntity[] = [];

    for (const row of rows) {
      const e = preset ? preset.normalize(row) : normalizeDefRow(def!, row, ACTIVE_LOCALES);
      if (!e || seen.has(e.qid)) continue;
      seen.add(e.qid);

      // Quality filter 1: labels in ALL active locales (also a quality signal)
      if (!ACTIVE_LOCALES.every((l) => e.labels[l])) {
        droppedNoLabels++;
        continue;
      }
      // Quality filter 2: mechanic-required fields present
      const missing = requiredRoles.some((r) => {
        const v = e.values[r];
        return v == null || (Array.isArray(v) && v.length === 0);
      });
      if (missing) {
        droppedMissingRequired++;
        continue;
      }
      entities.push(e);
    }

    // NEW: entityRef enrichment — convert bare QIDs into {qid, labels} via a
    // VALUES label query, so relation games work on LIVE data too.
    await enrichRefs(
      entities,
      fieldSchema.filter((f) => f.kind === "entityRefList").map((f) => f.role),
      ACTIVE_LOCALES,
    );

    // Quality filter 3: image URL availability — no fake/broken images in games.
    // Checks every image-kind field value; broken URLs are dropped from the
    // entity, and entities that lose a REQUIRED image role are dropped fully.
    const imageRoles = fieldSchema.filter((f) => f.kind === "image").map((f) => f.role);
    const allImageUrls = entities.flatMap((e) =>
      imageRoles.map((r) => e.values[r] as string | undefined),
    );
    const definedUrls = allImageUrls.filter(Boolean).length;
    const okUrls = await filterWorkingUrls(allImageUrls, 5);
    // META-GUARD: mass failure = broken validator (rate limit/network),
    // not broken files — keep the URLs instead of gutting the dataset.
    const validationDegraded = definedUrls > 0 && okUrls.size / definedUrls < 0.5;
    let brokenImages = 0;
    if (!validationDegraded) {
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
    }
    const validated = entities.filter(
      (e) =>
        !requiredRoles.some((r) => {
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
    for (const f of fieldSchema) {
      fieldCoverage[f.role] = entities.filter((e) => {
        const v = e.values[f.role];
        return v != null && (!Array.isArray(v) || v.length > 0);
      }).length;
    }

    const report: ValidationReport = {
      fetched: rows.length,
      accepted: entities.length,
      ...(totalExisting != null ? { totalExisting } : {}),
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

    // Derive games for this topic. PIPELINE v2: games are NEVER auto-published —
    // new ones are created `unlisted`, the admin previews and publishes with an
    // explicit button. A re-sync keeps the status of EXISTING games untouched
    // (only topicId/config refresh). Level math still runs here so the admin
    // sees playable previews right away.
    const PER_LEVEL = 20;
    const gamesSpec = preset ? (STARTER_GAMES[preset.key] ?? []) : autoGamesFor(def!);
    for (const g of gamesSpec) {
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
        // stored so the publish gate can refuse too-thin games (would 404)
        itemsCount: withRole,
      };
      await db
        .insert(games)
        .values({
          slug: g.slug,
          topicId: topic.id,
          mechanic: g.mechanic,
          config,
          style: { icon: g.icon },
          title: g.title,
          status: "unlisted", // explicit publish only (pipeline v2)
        })
        .onConflictDoUpdate({
          target: games.slug,
          set: { topicId: topic.id, config }, // status of existing games untouched
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


/** Fetch labels for referenced QIDs and inflate string refs into {qid, labels}. */
async function enrichRefs(
  entities: RawEntity[],
  refRoles: string[],
  locales: readonly string[],
) {
  if (refRoles.length === 0) return;
  const qids = new Set<string>();
  for (const e of entities) {
    for (const r of refRoles) {
      const v = e.values[r];
      if (Array.isArray(v)) for (const x of v) if (typeof x === "string") qids.add(x);
    }
  }
  if (qids.size === 0) return;

  const labelMap = new Map<string, Record<string, string>>();
  const all = [...qids];
  for (let i = 0; i < all.length; i += 150) {
    const chunk = all.slice(i, i + 150);
    const q = `SELECT ?item ${locales.map((l) => `?l_${l}`).join(" ")} WHERE {
  VALUES ?item { ${chunk.map((x) => `wd:${x}`).join(" ")} }
  ${locales.map((l) => `OPTIONAL { ?item rdfs:label ?l_${l} . FILTER(LANG(?l_${l}) = "${l}") }`).join("\n  ")}
}`;
    const rows = await sparqlQuery(q);
    for (const row of rows) {
      const qid = qidFromUri(row.item?.value ?? "");
      const labels: Record<string, string> = {};
      for (const l of locales) {
        const v = row[`l_${l}`]?.value;
        if (v) labels[l] = v;
      }
      if (labels.en) labelMap.set(qid, labels);
    }
  }

  for (const e of entities) {
    for (const r of refRoles) {
      const v = e.values[r];
      if (Array.isArray(v)) {
        e.values[r] = v
          .map((x) =>
            typeof x === "string"
              ? labelMap.has(x)
                ? { qid: x, labels: labelMap.get(x)! }
                : null
              : x,
          )
          .filter(Boolean);
      }
    }
  }
}
