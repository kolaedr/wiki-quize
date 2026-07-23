"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, games, topicEntities, topics } from "@/db/schema";
import { validateDef, type TopicDef } from "@/lib/ingest/def";
import {
  discoverProperties,
  sampleEntity,
  searchClasses,
  sitelinksDistribution,
  type ClassCandidate,
  type ProbeProperty,
  type SampleEntity,
} from "@/lib/ingest/probe";
import { MIN_PUBLISHABLE_ITEMS, runImport } from "@/lib/ingest/run";
import { getAdminSession } from "./guard";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Admin button: import / resync a topic (code preset OR no-code definition). */
export async function importPresetAction(presetKey: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };

  try {
    const report = await runImport(presetKey);
    revalidatePath("/admin");
    revalidatePath("/");
    return {
      ok: true,
      message: `${report.accepted} entities (fetched ${report.fetched}, dropped: labels ${report.droppedNoLabels}, fields ${report.droppedMissingRequired})`,
    };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 300) };
  }
}

/** Publish / unpublish a game from the admin panel. */
export async function setGameStatusAction(
  gameId: string,
  status: "published" | "unlisted" | "blocked",
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    // Publish gate: a game with too few playable items would 404 — refuse.
    if (status === "published") {
      const [g] = await db
        .select({ config: games.config })
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);
      const items = (g?.config as { itemsCount?: number } | null)?.itemsCount;
      if (items != null && items < MIN_PUBLISHABLE_ITEMS)
        return {
          ok: false,
          message: `лише ${items} айтемів — мінімум ${MIN_PUBLISHABLE_ITEMS} для публікації`,
        };
    }
    await db.update(games).set({ status }).where(eq(games.id, gameId));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: status };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}


export interface ClassSearchResult {
  ok: boolean;
  message?: string;
  classes?: ClassCandidate[];
}

/** Search Wikidata classes by word (no QID needed) — see searchClasses. */
export async function searchClassesAction(query: string): Promise<ClassSearchResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  if (!query.trim()) return { ok: true, classes: [] };
  try {
    return { ok: true, classes: await searchClasses(query) };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}

export interface ProbeResult {
  ok: boolean;
  message?: string;
  /** sitelinks → item count; any threshold count is computed client-side */
  distribution?: { sitelinks: number; n: number }[];
  sampleSize?: number;
  properties?: ProbeProperty[];
  sample?: SampleEntity | null;
}

/**
 * PIPELINE v2, step 1 — розвідка класу перед імпортом: скільки айтемів існує
 * (розподіл sitelinks), які властивості реально заповнені (тип + покриття %),
 * і як виглядає топ-сутність. Три SPARQL-запити, БЕЗ запису в базу.
 */
export async function probeClassAction(classQidsRaw: string): Promise<ProbeResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const classQids = classQidsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (classQids.length === 0 || classQids.some((q) => !/^Q\d+$/.test(q)))
    return { ok: false, message: "Класи мають бути виду Q3231690 (через кому)" };
  try {
    // Independent so one timed-out sub-query (big class) still returns partial
    // probe data instead of failing the whole reconnaissance.
    const [distRes, discRes] = await Promise.allSettled([
      sitelinksDistribution(classQids),
      discoverProperties(classQids),
    ]);
    const distribution = distRes.status === "fulfilled" ? distRes.value : [];
    const discovered =
      discRes.status === "fulfilled" ? discRes.value : { sampleSize: 0, properties: [] };

    if (distRes.status === "rejected" && discRes.status === "rejected")
      return {
        ok: false,
        message:
          "Клас завеликий — запити впираються в таймаут Wikidata. Обери вужчий клас або підніми поріг sitelinks.",
      };

    // preview a top entity with the supported discovered properties
    const supported = discovered.properties.filter((p) => p.kind).map((p) => p.prop);
    const sample = await sampleEntity(classQids, supported).catch(() => null);
    return {
      ok: true,
      message:
        distRes.status === "rejected" || discRes.status === "rejected"
          ? "Частина розвідки не встигла (клас великий) — показано що вдалось."
          : undefined,
      distribution,
      sampleSize: discovered.sampleSize,
      properties: discovered.properties,
      sample,
    };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 300) };
  }
}

/** NO-CODE builder: save a topic definition and run its first import. */
export async function createTopicAction(def: TopicDef): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    validateDef(def);
  } catch (err) {
    return { ok: false, message: String(err) };
  }
  try {
    await db
      .insert(topics)
      .values({
        slug: def.slug,
        title: def.title,
        sourceConfig: { def, icon: def.icon },
        fieldSchema: def.fields.map((f) => ({ role: f.role, kind: f.kind, wikidataProp: f.prop })),
        status: "syncing",
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: { sourceConfig: { def, icon: def.icon }, title: def.title },
      });
    const report = await runImport(def.slug);
    revalidatePath("/admin");
    revalidatePath("/");
    return {
      ok: true,
      message: `${report.accepted}${
        report.totalExisting != null ? ` з ${report.totalExisting} існуючих` : ""
      } сутностей; ігри створено як unlisted — публікуй у розділі «Ігри»`,
    };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 300) };
  }
}

/** Create a browse category (top-level grouping of datasets). */
export async function createCategoryAction(
  slug: string,
  titleEn: string,
  titleUk: string,
  icon: string,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(s)) return { ok: false, message: "slug: a-z, 0-9, -" };
  if (!titleEn.trim()) return { ok: false, message: "Назва (EN) обовʼязкова" };
  try {
    await db
      .insert(categories)
      .values({
        slug: s,
        title: { en: titleEn.trim(), ...(titleUk.trim() ? { uk: titleUk.trim() } : {}) },
        icon: icon || null,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          title: { en: titleEn.trim(), ...(titleUk.trim() ? { uk: titleUk.trim() } : {}) },
          icon: icon || null,
        },
      });
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "категорію збережено" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}

/** Assign a dataset (topic) to a category, or clear it (categoryId=""). */
export async function setTopicCategoryAction(
  topicSlug: string,
  categoryId: string,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db
      .update(topics)
      .set({ categoryId: categoryId || null })
      .where(eq(topics.slug, topicSlug));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "категорію призначено" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}

/**
 * Clean reset: wipe ALL content (categories, datasets, entities, games, and —
 * via cascade — their sessions/jobs/reports) so it can be rebuilt structurally
 * through the builder. Auth data is untouched.
 */
export async function resetContentAction(): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db.delete(games); // sessions/reports/challenges cascade off games
    await db.delete(topics); // entities + import jobs cascade off topics
    await db.delete(categories);
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "базу контенту очищено" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}

/** Toggle a single item on/off for all games of its topic. */
export async function toggleEntityAction(entityId: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    const [row] = await db
      .select({ excluded: topicEntities.excluded })
      .from(topicEntities)
      .where(eq(topicEntities.id, entityId))
      .limit(1);
    if (!row) return { ok: false, message: "not found" };
    await db
      .update(topicEntities)
      .set({ excluded: !row.excluded })
      .where(eq(topicEntities.id, entityId));
    revalidatePath("/admin", "layout");
    return { ok: true, message: row.excluded ? "увімкнено" : "вимкнено" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
  }
}
