"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games, topicEntities, topics } from "@/db/schema";
import { validateDef, type TopicDef } from "@/lib/ingest/def";
import { runImport } from "@/lib/ingest/run";
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
    await db.update(games).set({ status }).where(eq(games.id, gameId));
    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, message: status };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 200) };
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
      message: `${report.accepted} entities; games created (levels by ${report.accepted > 0 ? "difficulty" : "-"})`,
    };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 300) };
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
