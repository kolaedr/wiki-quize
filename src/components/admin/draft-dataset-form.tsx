"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDraftTopicAction, type CreateDraftResult } from "@/lib/admin/actions";

import { ICON_NAMES } from "@/components/game-icon";

const ICONS = ICON_NAMES;

/**
 * Step 1 of the dataset-first flow: create an empty dataset (name + icon),
 * then jump to its page where you pick the Wikidata class, probe it, tick the
 * fields to pull, and import. No class/fields here — keeps creation trivial.
 */
export function DraftDatasetForm({ categoryId }: { categoryId?: string } = {}) {
  const router = useRouter();
  const [en, setEn] = useState("");
  const [uk, setUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CreateDraftResult | null>(null);

  const submit = () =>
    start(async () => {
      const r = await createDraftTopicAction(en, uk, icon, categoryId ?? "");
      setResult(r);
      if (r.ok && r.slug) router.push(`/admin/topics/${r.slug}`);
    });

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      <p className="text-xs text-muted">
        Спершу назви датасет — далі на його сторінці знайдеш клас Wikidata,
        зробиш розвідку й позначиш галочками, які поля тягнути.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Назва (EN)" value={en} onChange={(e) => setEn(e.target.value)} />
        <Input placeholder="Назва (UK)" value={uk} onChange={(e) => setUk(e.target.value)} />
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="glass-card h-12 rounded-xl px-3 text-sm text-fg outline-none"
        >
          {ICONS.map((i) => (
            <option key={i} value={i}>іконка: {i}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending || !en.trim()} onClick={submit}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Створити датасет
        </Button>
        {result && !result.ok && <span className="text-xs text-danger">{result.message}</span>}
      </div>
    </div>
  );
}
