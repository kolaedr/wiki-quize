"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, games, topicEntities, topics } from "@/db/schema";
import {
  autoGamesFor,
  validateDef,
  type TopicDef,
  type TopicFieldDef,
} from "@/lib/ingest/def";
import {
  countForClass,
  discoverFields,
  searchClasses,
  type ClassCandidate,
  type ProbeField,
} from "@/lib/ingest/probe";
import { MIN_PUBLISHABLE_ITEMS, STARTER_GAMES, runImport } from "@/lib/ingest/run";
import { getJob, importTick, startDefImportJob, type JobView } from "@/lib/ingest/job";
import { getAdminSession } from "./guard";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Drizzle wraps DB failures as "Failed query: <sql>" and hides the real
 * Postgres reason in `err.cause`. Surface the cause so admin errors are
 * actionable, and hint at an unapplied migration when a table/column is
 * missing.
 */
function dbError(err: unknown): string {
  const e = err as { cause?: { message?: string }; message?: string };
  const raw = (e?.cause?.message ?? e?.message ?? String(err)).trim();
  if (/does not exist/i.test(raw))
    return `${raw} — схоже, не застосовано міграцію: npm run db:migrate`;
  return raw.slice(0, 240);
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
    return { ok: false, message: dbError(err) };
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
    return { ok: false, message: dbError(err) };
  }
}

/**
 * PAIR COMPOSER: create/update the selected proposed games for a dataset as
 * `unlisted`, with admin-edited titles. Level math mirrors the import; a
 * re-run only refreshes title/config, never the status of an existing game.
 */
export async function createGamesAction(
  topicSlug: string,
  selections: { slug: string; titleEn: string; titleUk: string }[],
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  if (selections.length === 0) return { ok: false, message: "нічого не обрано" };
  try {
    const [topic] = await db.select().from(topics).where(eq(topics.slug, topicSlug)).limit(1);
    if (!topic) return { ok: false, message: "датасет не знайдено" };
    const sc = topic.sourceConfig as { def?: TopicDef; preset?: string } | null;
    const specs = sc?.def
      ? autoGamesFor(sc.def)
      : sc?.preset
        ? (STARTER_GAMES[sc.preset] ?? [])
        : [];
    const bySlug = new Map(specs.map((s) => [s.slug, s]));

    const entities = await db
      .select({ values: topicEntities.values })
      .from(topicEntities)
      .where(and(eq(topicEntities.topicId, topic.id), eq(topicEntities.excluded, false)));

    const PER_LEVEL = 20;
    let n = 0;
    for (const sel of selections) {
      const g = bySlug.get(sel.slug);
      if (!g) continue;
      const withRole = g.countRole
        ? entities.filter((e) => {
            const v = (e.values as Record<string, unknown>)[g.countRole!];
            return v != null && (!Array.isArray(v) || v.length > 0);
          }).length
        : entities.length;
      const config = {
        ...g.config,
        deckSize: 10,
        perLevel: PER_LEVEL,
        levels: Math.max(1, Math.ceil(withRole / PER_LEVEL)),
        itemsCount: withRole,
      };
      const title = {
        en: sel.titleEn.trim() || g.title.en || g.slug,
        ...(sel.titleUk.trim()
          ? { uk: sel.titleUk.trim() }
          : g.title.uk
            ? { uk: g.title.uk }
            : {}),
      };
      await db
        .insert(games)
        .values({
          slug: g.slug,
          topicId: topic.id,
          mechanic: g.mechanic,
          config,
          style: { icon: g.icon },
          title,
          status: "unlisted",
        })
        .onConflictDoUpdate({
          target: games.slug,
          set: { topicId: topic.id, config, title }, // status untouched on existing
        });
      n++;
    }
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: `створено/оновлено ігор: ${n} (unlisted — публікуй у «Ігри»)` };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/** Rename a game (localized title) — clean up auto-generated names. */
export async function renameGameAction(
  gameId: string,
  titleEn: string,
  titleUk: string,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  if (!titleEn.trim()) return { ok: false, message: "Назва (EN) обовʼязкова" };
  try {
    await db
      .update(games)
      .set({ title: { en: titleEn.trim(), ...(titleUk.trim() ? { uk: titleUk.trim() } : {}) } })
      .where(eq(games.id, gameId));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "назву збережено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/** Delete a game (its play sessions cascade off). */
export async function deleteGameAction(gameId: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db.delete(games).where(eq(games.id, gameId));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "гру видалено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
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
    return { ok: false, message: dbError(err) };
  }
}

export interface ProbeResult {
  ok: boolean;
  message?: string;
  /** how many items exist at the threshold (single COUNT) */
  total?: number;
  /** how many top items the fields were sampled from */
  sampleSize?: number;
  /** labels of the sampled items (so the admin knows where examples came from) */
  sampleLabels?: string[];
  /** filled fields across the sampled items (coverage + previews) */
  fields?: ProbeField[];
}

const parseQids = (raw: string) =>
  raw.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * LIGHT probe: how many items there will be (one COUNT) + which fields are
 * filled across the TOP ~12 items (root = English). Fast; the heavy pull runs
 * later as a batched job.
 */
export async function probeClassAction(
  classQidsRaw: string,
  threshold = 30,
): Promise<ProbeResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const classQids = parseQids(classQidsRaw);
  if (classQids.length === 0 || classQids.some((q) => !/^Q\d+$/.test(q)))
    return { ok: false, message: "Класи мають бути виду Q3231690 (через кому)" };
  const [countRes, fieldsRes] = await Promise.allSettled([
    countForClass(classQids, threshold),
    discoverFields(classQids),
  ]);
  const total = countRes.status === "fulfilled" ? countRes.value : undefined;
  const disc = fieldsRes.status === "fulfilled" ? fieldsRes.value : null;
  if (total == null && !disc)
    return { ok: false, message: "Клас недоступний або завеликий — спробуй вужчий клас." };
  return {
    ok: true,
    total,
    sampleSize: disc?.sampleSize,
    sampleLabels: disc?.sampleLabels ?? [],
    fields: disc?.fields ?? [],
    message: disc ? undefined : "Поля не завантажились — спробуй ще раз.",
  };
}

export interface CountResult {
  ok: boolean;
  total?: number;
  message?: string;
}

/** Light re-count at a new threshold (used when the admin drags the slider). */
export async function countClassAction(
  classQidsRaw: string,
  threshold: number,
): Promise<CountResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const classQids = parseQids(classQidsRaw);
  if (classQids.length === 0) return { ok: false, message: "немає класів" };
  try {
    return { ok: true, total: await countForClass(classQids, Number(threshold) || 0) };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

export interface CreateDraftResult extends ActionResult {
  slug?: string;
}

/**
 * DATASET-FIRST flow: create an empty draft dataset (name + icon + category)
 * with NO class/fields yet. The builder (class search, probe, field checkboxes,
 * import) then happens on the dataset's own page — see setupTopicAction.
 */
export async function createDraftTopicAction(
  titleEn: string,
  titleUk: string,
  icon: string,
  categoryId = "",
): Promise<CreateDraftResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  if (!titleEn.trim()) return { ok: false, message: "Назва (EN) обовʼязкова" };
  const slug = titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!/^[a-z0-9-]{2,40}$/.test(slug))
    return { ok: false, message: "Назва має містити латинські літери/цифри для slug" };
  try {
    const [exists] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);
    if (exists) return { ok: false, message: `slug "${slug}" вже зайнятий — зміни назву` };
    await db.insert(topics).values({
      slug,
      title: { en: titleEn.trim(), ...(titleUk.trim() ? { uk: titleUk.trim() } : {}) },
      sourceConfig: { icon },
      fieldSchema: [],
      status: "draft",
      ...(categoryId ? { categoryId } : {}),
    });
    revalidatePath("/admin");
    return { ok: true, message: "датасет створено", slug };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/**
 * Save a draft dataset's class + fields (chosen via probe checkboxes) and run
 * the first import. Runs on the dataset page, after createDraftTopicAction.
 */
export async function setupTopicAction(
  topicSlug: string,
  classQids: string[],
  sitelinksMin: number,
  fields: TopicFieldDef[],
  locales: string[] = ["en"],
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    const [topic] = await db.select().from(topics).where(eq(topics.slug, topicSlug)).limit(1);
    if (!topic) return { ok: false, message: "датасет не знайдено" };
    const icon = (topic.sourceConfig as { icon?: string })?.icon ?? "deck";
    // root = "en" always; keep chosen extras after it, deduped
    const locs = ["en", ...locales.filter((l) => l && l !== "en")];
    const def: TopicDef = {
      slug: topic.slug,
      title: topic.title as Record<string, string>,
      icon,
      classQids,
      sitelinksMin: Number(sitelinksMin) || 0,
      limit: 600,
      fields,
      locales: locs,
    };
    validateDef(def);
    // SAVE config only — the heavy import runs as a batched job (startImportJobAction),
    // driven tick-by-tick from the client so nothing hangs for minutes.
    await db
      .update(topics)
      .set({
        sourceConfig: { def, icon },
        fieldSchema: fields.map((f) => ({ role: f.role, kind: f.kind, wikidataProp: f.prop })),
      })
      .where(eq(topics.id, topic.id));
    revalidatePath("/admin");
    return { ok: true, message: "конфіг збережено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

export interface StartJobResult {
  ok: boolean;
  jobId?: string;
  message?: string;
}

/** Start a batched import job for a configured dataset; poll with importTickAction. */
export async function startImportJobAction(topicSlug: string): Promise<StartJobResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const r = await startDefImportJob(topicSlug);
  return "error" in r ? { ok: false, message: r.error } : { ok: true, jobId: r.jobId };
}

/** Run ONE batch of an import job. The client calls this N times on demand. */
export async function importTickAction(jobId: string): Promise<JobView> {
  if (!(await getAdminSession()))
    return { jobId, status: "failed", phase: "done", batchIndex: 0, totalBatches: 0, batchSizes: [], accepted: 0, done: true, message: "forbidden" };
  const p = await importTick(jobId);
  if (p.done) {
    revalidatePath("/admin");
    revalidatePath("/");
  }
  return p;
}

/** Read a job's current state (for the batch table), no work done. */
export async function getJobAction(jobId: string): Promise<JobView | null> {
  if (!(await getAdminSession())) return null;
  return getJob(jobId);
}

/** NO-CODE builder: save a topic definition and run its first import. */
export async function createTopicAction(
  def: TopicDef,
  categoryId = "",
): Promise<ActionResult> {
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
        ...(categoryId ? { categoryId } : {}),
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: {
          sourceConfig: { def, icon: def.icon },
          title: def.title,
          ...(categoryId ? { categoryId } : {}),
        },
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
    return { ok: false, message: dbError(err) };
  }
}

/**
 * Create a browse category, optionally nested. `title` is per-locale
 * ({ en: required root, uk, de, … }) — English is the root, extra languages are
 * added by ISO code so users/wiki data can be tied per language later.
 */
export async function createCategoryAction(
  slug: string,
  title: Record<string, string>,
  icon: string,
  parentId = "",
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  const en = (title?.en ?? "").trim();
  if (!en) return { ok: false, message: "English name is required (root language)" };
  const s = (slug.trim() || en)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!/^[a-z0-9-]{2,40}$/.test(s))
    return { ok: false, message: "English name must contain latin letters/digits for the slug" };
  // keep only non-empty locale values, en first
  const cleaned: Record<string, string> = { en };
  for (const [loc, name] of Object.entries(title))
    if (loc !== "en" && /^[a-z]{2,3}$/.test(loc) && name?.trim()) cleaned[loc] = name.trim();
  try {
    await db
      .insert(categories)
      .values({ slug: s, title: cleaned, icon: icon || null, parentId: parentId || null })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { title: cleaned, icon: icon || null, parentId: parentId || null },
      });
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "категорію збережено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/** Move a category under another parent (or to the top level, parentId=""). */
export async function setCategoryParentAction(
  slug: string,
  parentId: string,
): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (!cat) return { ok: false, message: "категорію не знайдено" };
    if (parentId && parentId === cat.id)
      return { ok: false, message: "категорія не може бути власним батьком" };
    await db.update(categories).set({ parentId: parentId || null }).where(eq(categories.id, cat.id));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: parentId ? "переміщено" : "піднято на верхній рівень" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/** Delete a category (datasets become uncategorized; children move to top). */
export async function deleteCategoryAction(slug: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db.delete(categories).where(eq(categories.slug, slug));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "категорію видалено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
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
    return { ok: false, message: dbError(err) };
  }
}

/**
 * Clean reset of CONTENT: wipe datasets + games (entities/jobs/sessions cascade
 * off them) so it can be rebuilt through the builder. KEEPS the category
 * structure — that's the scaffolding the admin already set up. Auth untouched.
 */
export async function resetContentAction(): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db.delete(games); // sessions/reports/challenges cascade off games
    await db.delete(topics); // entities + import jobs cascade off topics
    // categories are intentionally kept
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "датасети й ігри очищено (категорії лишились)" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
  }
}

/** Delete a single dataset (its entities, games, jobs cascade off it). */
export async function deleteTopicAction(topicSlug: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    await db.delete(topics).where(eq(topics.slug, topicSlug));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: "датасет видалено" };
  } catch (err) {
    return { ok: false, message: dbError(err) };
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
    return { ok: false, message: dbError(err) };
  }
}
