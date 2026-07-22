"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { PRESETS } from "@/lib/ingest/presets";
import { runImport } from "@/lib/ingest/run";
import { getAdminSession } from "./guard";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Admin button: import / resync a preset topic from Wikidata (creates games + levels). */
export async function importPresetAction(presetKey: string): Promise<ActionResult> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  if (!PRESETS[presetKey]) return { ok: false, message: `unknown preset: ${presetKey}` };

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
