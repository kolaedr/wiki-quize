"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Link2, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createGamesAction, type ActionResult } from "@/lib/admin/actions";

export interface ProposalView {
  slug: string;
  titleEn: string;
  titleUk: string;
  mechanic: string;
  predictedItems: number;
  exists: boolean;
  existingStatus?: string;
  linkToSlug?: string;
  linkToTitle?: string;
}

const MIN_PUBLISHABLE = 8;

/**
 * "Можливі ігри" — proposals derived from the dataset's fields. The admin
 * checks the ones to build, edits names, and creates them (unlisted). Relation
 * games show which sibling dataset their references point to.
 */
export function GameComposer({
  topicSlug,
  proposals,
}: {
  topicSlug: string;
  proposals: ProposalView[];
}) {
  const [rows, setRows] = useState(() => proposals.map((p) => ({ ...p, checked: false })));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const patch = (i: number, p: Partial<(typeof rows)[number]>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = () =>
    start(async () => {
      const sel = rows
        .filter((r) => r.checked)
        .map((r) => ({ slug: r.slug, titleEn: r.titleEn, titleUk: r.titleUk }));
      if (sel.length === 0) {
        setResult({ ok: false, message: "нічого не обрано" });
        return;
      }
      setResult(await createGamesAction(topicSlug, sel));
    });

  if (proposals.length === 0)
    return (
      <p className="text-sm text-muted">
        Для цього датасету поки немає можливих ігор (немає підхожих полів).
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const thin = r.predictedItems < MIN_PUBLISHABLE;
        return (
          <div key={r.slug} className="glass-card flex flex-col gap-2 p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={r.checked}
                onChange={(e) => patch(i, { checked: e.target.checked })}
                className="mt-1.5"
              />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono">/{r.slug}</span>
                  <Badge variant="muted">{r.mechanic}</Badge>
                  <span className={thin ? "text-danger" : ""}>
                    айтемів: {r.predictedItems}
                    {thin ? ` (< ${MIN_PUBLISHABLE} — не опублікується)` : ""}
                  </span>
                  {r.exists && <Badge variant="muted">вже є: {r.existingStatus}</Badge>}
                  {r.linkToTitle && (
                    <span className="flex items-center gap-1 text-accent">
                      <Link2 size={12} /> звʼязок <ArrowRight size={11} /> {r.linkToTitle}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-9"
                    placeholder="Назва (EN)"
                    value={r.titleEn}
                    onChange={(e) => patch(i, { titleEn: e.target.value })}
                  />
                  <Input
                    className="h-9"
                    placeholder="Назва (UK)"
                    value={r.titleUk}
                    onChange={(e) => patch(i, { titleUk: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={submit}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Створити обрані (unlisted)
        </Button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
