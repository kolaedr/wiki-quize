import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { sparqlQuery } from "@/lib/wikidata/sparql";
import { PRESETS, type RawEntity } from "./presets";

const STARTER_GAMES: Record<
  string,
  { slug: string; title: Record<string, string>; answerRole: string; emoji: string }[]
> = {
  countries: [
    {
      slug: "flags",
      title: { en: "Flags of the World", uk: "Прапори світу" },
      answerRole: "flag",
      emoji: "🚩",
    },
    {
      slug: "coat-of-arms",
      title: { en: "Coats of Arms", uk: "Герби країн" },
      answerRole: "arms",
      emoji: "🛡️",
    },
  ],
  "car-brands": [
    {
      slug: "car-logos",
      title: { en: "Car Logos", uk: "Логотипи авто" },
      answerRole: "logo",
      emoji: "🚗",
    },
  ],
};

export interface ValidationReport {
  fetched: number;
  accepted: number;
  droppedNoLabels: number;
  droppedMissingRequired: number;
  fieldCoverage: Record<string, number>;
  finishedAt: string;
}

/**
 * Full import of a preset topic (small topics fit one invocation;
 * chunked/cursor mode is a stage-1 TODO for user-created topics).
 */
export async function runImport(presetKey: string): Promise<ValidationReport> {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

  // Upsert the topic shell first
  const [topic] = await db
    .insert(topics)
    .values({
      slug: preset.slug,
      title: preset.title,
      sourceConfig: { preset: preset.key },
      fieldSchema: preset.fieldSchema,
      status: "syncing",
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { status: "syncing" },
    })
    .returning();

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

    // Difficulty = popularity percentile within the topic (1 = most famous)
    const sorted = [...entities].sort((a, b) => b.sitelinks - a.sitelinks);
    const rank = new Map(sorted.map((e, i) => [e.qid, 1 - i / Math.max(1, sorted.length - 1)]));

    // Replace-all write (presets are small; per-row upsert keeps `excluded` flags — TODO for UGC)
    await db.delete(topicEntities).where(eq(topicEntities.topicId, topic.id));
    const CHUNK = 100;
    for (let i = 0; i < entities.length; i += CHUNK) {
      await db.insert(topicEntities).values(
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
      );
    }

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
      fieldCoverage,
      finishedAt: new Date().toISOString(),
    };

    await db
      .update(topics)
      .set({ status: "published", syncedAt: new Date(), validationReport: report })
      .where(eq(topics.id, topic.id));

    // Auto-create starter games for this preset (published; idempotent by slug).
    // Games needing labels of RELATED entities (languages, origin countries)
    // wait for the reference-label enrichment pass — see stage-1 checklist.
    for (const g of STARTER_GAMES[preset.key] ?? []) {
      await db
        .insert(games)
        .values({
          slug: g.slug,
          topicId: topic.id,
          mechanic: "choice",
          config: { answerRole: g.answerRole, deckSize: 10 },
          style: { emoji: g.emoji },
          title: g.title,
          status: "published",
        })
        .onConflictDoUpdate({
          target: games.slug,
          set: { topicId: topic.id, status: "published" },
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
    await db.update(topics).set({ status: "draft" }).where(eq(topics.id, topic.id));
    throw err;
  }
}
