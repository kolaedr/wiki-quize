import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { filterWorkingUrls } from "@/lib/validate-urls";
import { sparqlQuery } from "@/lib/wikidata/sparql";
import { autoGamesFor, buildTopicQuery, normalizeDefRow, type TopicDef } from "./def";
import type { RawEntity } from "./presets";
import { enrichRefs } from "./run";

/**
 * BATCHED IMPORT JOB. The heavy pull is split into short units so the browser
 * can drive it tick-by-tick (a progress bar) instead of one request hanging for
 * minutes. Each fetch tick = ONE sitelinks band, upserted incrementally; a
 * final tick ranks difficulty, drops stale rows and creates the games.
 */

interface Band {
  min: number;
  max?: number;
}
interface Cursor {
  phase: "fetch" | "finalize" | "done";
  bands: Band[];
  bandIndex: number;
  runStartMs: number;
  accepted: number;
}

const BAND_STOPS = [2000, 800, 300, 150, 80, 50, 35, 25, 18, 12];
const MIN_PUBLISHABLE = 8;

export interface JobProgress {
  jobId: string;
  status: string;
  phase: string;
  step: number;
  totalSteps: number;
  accepted: number;
  done: boolean;
  message?: string;
}

/** Create a running import job for a def-topic; returns its id. */
export async function startDefImportJob(
  topicSlug: string,
): Promise<{ jobId: string } | { error: string }> {
  const [topic] = await db.select().from(topics).where(eq(topics.slug, topicSlug)).limit(1);
  if (!topic) return { error: "датасет не знайдено" };
  const def = (topic.sourceConfig as { def?: TopicDef } | null)?.def;
  if (!def) return { error: "датасет без конфігурації — спочатку налаштуй" };

  const stops = BAND_STOPS.filter((t) => t > def.sitelinksMin)
    .concat(def.sitelinksMin)
    .sort((a, b) => b - a);
  const bands: Band[] = [];
  let ceil: number | undefined;
  for (const floor of stops) {
    bands.push({ min: floor, max: ceil });
    ceil = floor;
  }

  await db
    .update(importJobs)
    .set({ status: "failed", finishedAt: new Date(), log: ["superseded by a new run"] })
    .where(and(eq(importJobs.topicId, topic.id), eq(importJobs.status, "running")));

  const cursor: Cursor = { phase: "fetch", bands, bandIndex: 0, runStartMs: Date.now(), accepted: 0 };
  const [job] = await db
    .insert(importJobs)
    .values({ topicId: topic.id, status: "running", startedAt: new Date(), cursor })
    .returning();
  return { jobId: job.id };
}

/** Do ONE unit of work for the job and report progress. Idempotent-ish per tick. */
export async function importTick(jobId: string): Promise<JobProgress> {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  if (!job)
    return { jobId, status: "failed", phase: "done", step: 0, totalSteps: 1, accepted: 0, done: true, message: "джоб не знайдено" };
  const cursor = job.cursor as unknown as Cursor;
  const totalSteps = cursor.bands.length + 1;

  if (job.status === "done" || cursor.phase === "done")
    return { jobId, status: "done", phase: "done", step: totalSteps, totalSteps, accepted: cursor.accepted, done: true };

  const [topic] = await db.select().from(topics).where(eq(topics.id, job.topicId)).limit(1);
  const def = (topic?.sourceConfig as { def?: TopicDef } | null)?.def;
  if (!topic || !def) {
    await db.update(importJobs).set({ status: "failed", finishedAt: new Date() }).where(eq(importJobs.id, jobId));
    return { jobId, status: "failed", phase: "done", step: 0, totalSteps, accepted: 0, done: true, message: "немає конфігу" };
  }

  const locales = def.locales?.length ? def.locales : [...ACTIVE_LOCALES];
  const rootLocale = locales[0];
  const requiredRoles = def.fields.filter((f) => f.required).map((f) => f.role);
  const imageRoles = def.fields.filter((f) => f.kind === "image").map((f) => f.role);
  const refRoles = def.fields.filter((f) => f.kind === "entityRefList").map((f) => f.role);
  const missingRequired = (e: RawEntity) =>
    requiredRoles.some((r) => {
      const v = e.values[r];
      return v == null || (Array.isArray(v) && v.length === 0);
    });

  try {
    if (cursor.phase === "fetch") {
      const band = cursor.bands[cursor.bandIndex];
      let bandAccepted = 0;
      try {
        const rows = await sparqlQuery(
          buildTopicQuery(def, locales, { min: band.min, maxExclusive: band.max }),
        );
        const seen = new Set<string>();
        const entities: RawEntity[] = [];
        for (const row of rows) {
          const e = normalizeDefRow(def, row, locales);
          if (!e || seen.has(e.qid)) continue;
          seen.add(e.qid);
          if (!e.labels[rootLocale]) continue;
          if (missingRequired(e)) continue;
          entities.push(e);
        }
        await enrichRefs(entities, refRoles, locales);

        const urls = entities.flatMap((e) => imageRoles.map((r) => e.values[r] as string | undefined));
        const defined = urls.filter(Boolean).length;
        const okUrls = await filterWorkingUrls(urls, 5);
        const degraded = defined > 0 && okUrls.size / defined < 0.5;
        if (!degraded)
          for (const e of entities)
            for (const r of imageRoles) {
              const u = e.values[r] as string | undefined;
              if (u && !okUrls.has(u)) {
                e.values[r] = undefined;
                if (e.imageUrl === u) e.imageUrl = undefined;
              }
            }
        const valid = entities.filter((e) => !missingRequired(e));

        const CHUNK = 100;
        for (let i = 0; i < valid.length; i += CHUNK) {
          await db
            .insert(topicEntities)
            .values(
              valid.slice(i, i + CHUNK).map((e) => ({
                topicId: topic.id,
                wikidataQid: e.qid,
                labels: e.labels,
                values: e.values,
                imageUrl: e.imageUrl,
                wikiLinks: e.wikiLinks,
                sitelinks: e.sitelinks,
                difficultyScore: 0,
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
                updatedAt: sql`now()`,
              },
            });
        }
        bandAccepted = valid.length;
      } catch (err) {
        if (!String(err).includes("504")) throw err; // a timed-out band is skipped
      }

      const bandIndex = cursor.bandIndex + 1;
      const next: Cursor = {
        ...cursor,
        bandIndex,
        accepted: cursor.accepted + bandAccepted,
        phase: bandIndex >= cursor.bands.length ? "finalize" : "fetch",
      };
      await db.update(importJobs).set({ cursor: next as unknown as object }).where(eq(importJobs.id, jobId));
      return {
        jobId,
        status: "running",
        phase: next.phase,
        step: bandIndex,
        totalSteps,
        accepted: next.accepted,
        done: false,
        message: `батч ${bandIndex}/${cursor.bands.length} · ${next.accepted} айтемів`,
      };
    }

    // finalize
    const runStart = new Date(cursor.runStartMs);
    await db.execute(sql`
      WITH ranked AS (
        SELECT id, percent_rank() OVER (ORDER BY sitelinks ASC) AS pr
        FROM topic_entities WHERE topic_id = ${topic.id} AND updated_at >= ${runStart}
      )
      UPDATE topic_entities t SET difficulty_score = r.pr FROM ranked r WHERE t.id = r.id`);

    if (cursor.accepted >= MIN_PUBLISHABLE) {
      await db
        .delete(topicEntities)
        .where(and(eq(topicEntities.topicId, topic.id), lt(topicEntities.updatedAt, runStart)));
    }

    const rowsForCount = await db
      .select({ values: topicEntities.values })
      .from(topicEntities)
      .where(and(eq(topicEntities.topicId, topic.id), eq(topicEntities.excluded, false)));
    const PER_LEVEL = 20;
    for (const g of autoGamesFor(def)) {
      const withRole = g.countRole
        ? rowsForCount.filter((e) => {
            const v = (e.values as Record<string, unknown>)[g.countRole!];
            return v != null && (!Array.isArray(v) || v.length > 0);
          }).length
        : rowsForCount.length;
      const config = {
        ...g.config,
        deckSize: 10,
        perLevel: PER_LEVEL,
        levels: Math.max(1, Math.ceil(withRole / PER_LEVEL)),
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
          status: "unlisted",
        })
        .onConflictDoUpdate({ target: games.slug, set: { topicId: topic.id, config } });
    }

    await db
      .update(topics)
      .set({
        status: "published",
        syncedAt: new Date(),
        validationReport: { accepted: cursor.accepted, finishedAt: new Date().toISOString() },
      })
      .where(eq(topics.id, topic.id));
    await db
      .update(importJobs)
      .set({ status: "done", finishedAt: new Date(), cursor: { ...cursor, phase: "done" } as unknown as object })
      .where(eq(importJobs.id, jobId));

    return {
      jobId,
      status: "done",
      phase: "done",
      step: totalSteps,
      totalSteps,
      accepted: cursor.accepted,
      done: true,
      message: `готово: ${cursor.accepted} айтемів`,
    };
  } catch (err) {
    await db
      .update(importJobs)
      .set({ status: "failed", finishedAt: new Date(), log: sql`${JSON.stringify([String(err)])}::jsonb` })
      .where(eq(importJobs.id, jobId));
    return {
      jobId,
      status: "failed",
      phase: "done",
      step: 0,
      totalSteps,
      accepted: cursor.accepted,
      done: true,
      message: String(err).slice(0, 200),
    };
  }
}
