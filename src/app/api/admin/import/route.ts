import { NextResponse } from "next/server";
import { runImport } from "@/lib/ingest/run";
import { PRESETS } from "@/lib/ingest/presets";

export const maxDuration = 300; // SPARQL + insert can take a while

/**
 * Vercel Cron (see vercel.json): weekly re-sync of all preset topics —
 * picks up wiki edits/fixes. Vercel sends `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results: Record<string, string> = {};
  for (const key of Object.keys(PRESETS)) {
    try {
      const r = await runImport(key);
      results[key] = `ok: ${r.accepted}`;
    } catch (err) {
      results[key] = `failed: ${String(err).slice(0, 120)}`;
    }
  }
  return NextResponse.json({ ok: true, results });
}

/**
 * Trigger a preset import:
 *   curl -X POST /api/admin/import -H "x-admin-secret: …" -d '{"preset":"countries"}'
 * Temporary guard via ADMIN_TASK_SECRET until the admin UI (role-based) lands.
 */
export async function POST(req: Request) {
  const secret = process.env.ADMIN_TASK_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { preset?: string };
  if (!body.preset || !PRESETS[body.preset]) {
    return NextResponse.json(
      { error: "unknown preset", available: Object.keys(PRESETS) },
      { status: 400 },
    );
  }

  try {
    const report = await runImport(body.preset);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
