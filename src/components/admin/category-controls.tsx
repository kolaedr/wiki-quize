"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategoryAction,
  setTopicCategoryAction,
  type ActionResult,
} from "@/lib/admin/actions";

export interface CategoryOption {
  id: string;
  slug: string;
  title: string;
}

const ICONS = ["car", "globe", "landmark", "scale", "flag", "shield", "languages", "users", "deck"];

/** Assign a dataset to a category (or clear it) right from the topics list. */
export function CategorySelect({
  topicSlug,
  categoryId,
  options,
}: {
  topicSlug: string;
  categoryId: string | null;
  options: CategoryOption[];
}) {
  const [value, setValue] = useState(categoryId ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(async () => {
          const r = await setTopicCategoryAction(topicSlug, next);
          setErr(!r.ok);
        });
      }}
      className={`glass-card h-9 rounded-xl px-2 text-xs outline-none ${err ? "text-danger" : "text-fg"}`}
      title="Категорія датасету"
    >
      <option value="">— без категорії —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.title}
        </option>
      ))}
    </select>
  );
}

/** Create a browse category (top-level grouping of datasets). */
export function NewCategoryForm() {
  const [slug, setSlug] = useState("");
  const [en, setEn] = useState("");
  const [uk, setUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const submit = () =>
    start(async () => {
      const r = await createCategoryAction(slug, en, uk, icon);
      setResult(r);
      if (r.ok) {
        setSlug("");
        setEn("");
        setUk("");
      }
    });

  return (
    <div className="glass-card flex flex-col gap-2 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Input className="h-10" placeholder="slug (auto)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Input className="h-10" placeholder="Назва (EN)" value={en} onChange={(e) => setEn(e.target.value)} />
        <Input className="h-10" placeholder="Назва (UK)" value={uk} onChange={(e) => setUk(e.target.value)} />
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="glass-card h-10 rounded-xl px-2 text-sm text-fg outline-none"
        >
          {ICONS.map((i) => (
            <option key={i} value={i}>іконка: {i}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending || !slug || !en} onClick={submit}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Створити категорію
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
