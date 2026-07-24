import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, importJobs, topicEntities, topics } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { filterWorkingUrls } from "@/lib/validate-urls";
import { qidFromUri, sparqlQuery } from "@/lib/wikidata/sparql";
import {
  autoGamesFor,
  buildEntityQuery,
  buildQidListQuery,
  normalizeDefRow,
  type TopicDef,
} from "./def";
import type { RawEntity } from "./presets";
import { enrichRefs } from "./run";

/**
 * BATCHED IMPORT JOB. The item list is fetched once (famous → obscure), split
 * into batches of ~BATCH_SIZE items, and each batch is a short request the
 * browser runs on demand (a checklist it can step through). A final tick ranks
 * difficulty, drops stale rows and creates the games.
 */

const BATCH_SIZE = 25;
const MIN_PUBLISHABLE = 8;

interface Cursor {
  phase: "fetch" | "finalize" | "done";
  batches: string[][]; // QIDs per batch
  batchIndex: number;
  runStartMs: number;
  accepted: number;
}

export interface JobView {
  jobId: string;
  status: string;
  phase: string;
  batchIndex: number;
  totalBatches: number;
  batchSizes: number[];
  accepted: number;
  done: boolean;
  message?: string;
  /** set when a batch failed but the job is still alive — it can be retried */
  error?: string;
}

const toView = (jobId: string, status: string, c: Cursor, message?: string): JobView => ({
  jobId,
  status,
  phase: c.phase,
  batchIndex: c.batchIndex,
  totalBatches: c.batches.length,
  batchSizes: c.batches.map((b) => b.length),
  accepted: c.accepted,
  done: status === "done" || status === "failed",
  message,
});

/** Newest job for a topic — so a page reload shows the queue where it stopped. */
export async function getLatestJob(topicSlug: string): Promise<JobView | null> {
  const [topic] = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, topicSlug)).limit(1);
  if (!topic) return null;
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.topicId, topic.id))
    .orderBy(desc(importJobs.createdAt))
    .limit(1);
  if (!job) return null;
  return toView(job.id, job.status, job.cursor as unknown as Cursor);
}

const failView = (jobId: string, message: string): JobView => ({
  jobId, status: "failed", phase: "done", batchIndex: 0, totalBatches: 0, batchSizes: [], accepted: 0, done: true, message,
});

/** Move the queue's start pointer — choose which batch runs next (skip / redo). */
export async function setJobStart(jobId: string, batchIndex: number): Promise<JobView> {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  if (!job) return failView(jobId, "джоб не знайдено");
  const cursor = job.cursor as unknown as Cursor;
  const idx = Math.max(0, Math.min(Math.floor(batchIndex), cursor.batches.length));
  const next: Cursor = {
    ...cursor,
    batchIndex: idx,
    phase: idx >= cursor.batches.length ? "finalize" : "fetch",
  };
  // reset to running so the controls come back even if it was done/failed
  await db
    .update(importJobs)
    .set({ cursor: next as unknown as object, status: "running", finishedAt: null })
    .where(eq(importJobs.id, jobId));
  return toView(jobId, "running", next, `старт з батча ${idx + 1}`);
}

export async function getJob(jobId: string): Promise<JobView | null> {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  if (!job) return null;
  return toView(jobId, job.status, job.cursor as unknown as Cursor);
}

/**
 * Create (or RESUME) a job. The queue lives in import_jobs.cursor, so an
 * unfinished run — after a failed batch or a page reload — is picked up where it
 * stopped instead of regenerating. `fresh` forces a brand-new queue.
 */
export async function startDefImportJob(
  topicSlug: string,
  fresh = false,
): Promise<{ jobId: string } | { error: string }> {
  const [topic] = await db.select().from(topics).where(eq(topics.slug, topicSlug)).limit(1);
  if (!topic) return { error: "датасет не знайдено" };
  const def = (topic.sourceConfig as { def?: TopicDef } | null)?.def;
  if (!def) return { error: "датасет без конфігурації — спочатку налаштуй" };

  // resume an unfinished queue instead of building a new one
  if (!fresh) {
    const [existing] = await db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.topicId, topic.id), eq(importJobs.status, "running")))
      .orderBy(desc(importJobs.createdAt))
      .limit(1);
    if (existing) {
      const c = existing.cursor as unknown as Cursor;
      if (c?.phase !== "done" && c?.batches?.length) return { jobId: existing.id };
    }
  }

  let qids: string[];
  try {
    const rows = await sparqlQuery(buildQidListQuery(def, def.sitelinksMin));
    qids = rows.map((r) => qidFromUri(r.item?.value ?? "")).filter((q) => /^Q\d+$/.test(q));
  } catch (err) {
    return { error: `не вдалося отримати список айтемів: ${String(err).slice(0, 120)}` };
  }
  if (qids.length === 0) return { error: "за цим порогом нема айтемів — знизь поріг" };

  const batches: string[][] = [];
  for (let i = 0; i < qids.length; i += BATCH_SIZE) batches.push(qids.slice(i, i + BATCH_SIZE));

  // starting fresh: retire any still-running job for this topic
  await db
    .update(importJobs)
    .set({ status: "failed", finishedAt: new Date(), log: ["superseded by a new run"] })
    .where(and(eq(importJobs.topicId, topic.id), eq(importJobs.status, "running")));

  const cursor: Cursor = { phase: "fetch", batches, batchIndex: 0, runStartMs: Date.now(), accepted: 0 };
  const [job] = await db
    .insert(importJobs)
    .values({ topicId: topic.id, status: "running", startedAt: new Date(), cursor })
    .returning();
  return { jobId: job.id };
}

/** Do ONE batch (or the finalize step) and report the new state. */
export async function importTick(jobId: string): Promise<JobView> {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  if (!job)
    return { jobId, status: "failed", phase: "done", batchIndex: 0, totalBatches: 0, batchSizes: [], accepted: 0, done: true, message: "джоб не знайдено" };
  const cursor = job.cursor as unknown as Cursor;

  if (job.status === "done" || cursor.phase === "done") return toView(jobId, "done", cursor);

  const [topic] = await db.select().from(topics).where(eq(topics.id, job.topicId)).limit(1);
  const def = (topic?.sourceConfig as { def?: TopicDef } | null)?.def;
  if (!topic || !def) {
    await db.update(importJobs).set({ status: "failed", finishedAt: new Date() }).where(eq(importJobs.id, jobId));
    return toView(jobId, "failed", cursor, "немає конфігу");
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
      const qids = cursor.batches[cursor.batchIndex];
      let batchAccepted = 0;
      const rows = await sparqlQuery(buildEntityQuery(def, locales, qids));
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

      if (valid.length) {
        await db
          .insert(topicEntities)
          .values(
            valid.map((e) => ({
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
      batchAccepted = valid.length;

      const batchIndex = cursor.batchIndex + 1;
      const next: Cursor = {
        ...cursor,
        batchIndex,
        accepted: cursor.accepted + batchAccepted,
        phase: batchIndex >= cursor.batches.length ? "finalize" : "fetch",
      };
      await db.update(importJobs).set({ cursor: next as unknown as object }).where(eq(importJobs.id, jobId));
      return toView(jobId, "running", next, `батч ${batchIndex}/${cursor.batches.length} · ${next.accepted} айтемів`);
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
    // Preserve manual game edits on re-sync: for a game that already exists we
    // refresh ONLY the item count + levels, keeping the admin's visual roles,
    // deckSize and perLevel. Only brand-new games get the full auto-config.
    const existingGames = await db
      .select({ slug: games.slug, config: games.config })
      .from(games)
      .where(eq(games.topicId, topic.id));
    const existingConfig = new Map(
      existingGames.map((g) => [g.slug, (g.config ?? {}) as Record<string, unknown>]),
    );
    for (const g of autoGamesFor(def)) {
      const withRole = g.countRole
        ? rowsForCount.filter((e) => {
            const v = (e.values as Record<string, unknown>)[g.countRole!];
            return v != null && (!Array.isArray(v) || v.length > 0);
          }).length
        : rowsForCount.length;
      const prev = existingConfig.get(g.slug);
      if (prev) {
        const perLevel = Number(prev.perLevel) || PER_LEVEL;
        await db
          .update(games)
          .set({
            config: { ...prev, itemsCount: withRole, levels: Math.max(1, Math.ceil(withRole / perLevel)) },
          })
          .where(eq(games.slug, g.slug));
      } else {
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
          .onConflictDoNothing();
      }
    }

    await db
      .update(topics)
      .set({
        status: "published",
        syncedAt: new Date(),
        validationReport: { accepted: cursor.accepted, finishedAt: new Date().toISOString() },
      })
      .where(eq(topics.id, topic.id));
    const doneCursor: Cursor = { ...cursor, phase: "done" };
    await db
      .update(importJobs)
      .set({ status: "done", finishedAt: new Date(), cursor: doneCursor as unknown as object })
      .where(eq(importJobs.id, jobId));

    return toView(jobId, "done", doneCursor, `готово: ${cursor.accepted} айтемів`);
  } catch (err) {
    const msg = String(err).slice(0, 200);
    // KEEP the job alive at the same batch so it can be retried — don't throw
    // away the queue. The cursor wasn't advanced (the failing step ran before
    // its write), so re-running repeats exactly the batch that failed.
    await db
      .update(importJobs)
      .set({ log: sql`${JSON.stringify([msg])}::jsonb` })
      .where(eq(importJobs.id, jobId));
    return {
      ...toView(jobId, "running", cursor, `батч впав: ${msg} — натисни «1 батч», щоб повторити`),
      error: msg,
    };
  }
}
