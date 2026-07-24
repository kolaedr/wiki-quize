"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ICON_NAMES } from "@/components/game-icon";
import {
  createCategoryAction,
  setCategoryParentAction,
  setTopicCategoryAction,
  type ActionResult,
} from "@/lib/admin/actions";

export interface CategoryOption {
  id: string;
  slug: string;
  title: string;
}

const ICONS = ICON_NAMES;

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

/** Move a category under another parent (or to the top level). */
export function CategoryParentSelect({
  slug,
  currentParentId,
  options,
}: {
  slug: string;
  currentParentId: string | null;
  options: CategoryOption[];
}) {
  const [value, setValue] = useState(currentParentId ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      під:
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          start(async () => {
            const r = await setCategoryParentAction(slug, v);
            setMsg(r.ok ? "✓" : r.message);
          });
        }}
        className="glass-card h-8 rounded-xl px-2 text-xs text-fg outline-none"
      >
        <option value="">— верхній рівень —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      {pending && <Loader2 size={12} className="animate-spin" />}
      {msg && <span className="text-[11px]">{msg}</span>}
    </span>
  );
}

/** Click-to-reveal panel — "Додати датасет/підкатегорію" opens a form. */
export function TogglePanel({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={open ? "ghost" : "secondary"}
        className="self-start"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={13} /> : <Plus size={13} />}
        {label}
      </Button>
      {open && children}
    </div>
  );
}

/** Attach an EXISTING dataset to this category (a select of unassigned ones). */
export function AttachDatasetSelect({
  categoryId,
  candidates,
}: {
  categoryId: string;
  candidates: { slug: string; title: string }[];
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (candidates.length === 0)
    return <p className="text-xs text-muted">Немає вільних датасетів для прикріплення.</p>;

  return (
    <span className="flex items-center gap-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const slug = e.target.value;
          setValue(slug);
          if (!slug) return;
          start(async () => {
            const r = await setTopicCategoryAction(slug, categoryId);
            setMsg(r.ok ? "прикріплено" : r.message);
            setValue("");
          });
        }}
        className="glass-card h-9 rounded-xl px-2 text-xs text-fg outline-none"
      >
        <option value="">+ прикріпити наявний датасет…</option>
        {candidates.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.title}
          </option>
        ))}
      </select>
      {pending && <Loader2 size={13} className="animate-spin text-muted" />}
      {msg && <span className="text-[11px] text-muted">{msg}</span>}
    </span>
  );
}

/**
 * Create a browse category. `parents` lets a category be nested under another;
 * `presetParentId` fixes the parent (used on a category detail page's
 * "add sub-category").
 */
export function NewCategoryForm({
  parents = [],
  presetParentId,
}: {
  parents?: CategoryOption[];
  presetParentId?: string;
}) {
  const [slug, setSlug] = useState("");
  const [en, setEn] = useState("");
  const [icon, setIcon] = useState("deck");
  const [parentId, setParentId] = useState(presetParentId ?? "");
  // extra languages by ISO code (English is the root, always)
  const [langs, setLangs] = useState<{ code: string; name: string }[]>([{ code: "uk", name: "" }]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const setLang = (i: number, patch: Partial<{ code: string; name: string }>) =>
    setLangs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = () =>
    start(async () => {
      const title: Record<string, string> = { en: en.trim() };
      for (const l of langs)
        if (/^[a-z]{2,3}$/.test(l.code.trim()) && l.name.trim())
          title[l.code.trim()] = l.name.trim();
      const r = await createCategoryAction(slug, title, icon, presetParentId ?? parentId);
      setResult(r);
      if (r.ok) {
        setSlug("");
        setEn("");
        setLangs([{ code: "uk", name: "" }]);
      }
    });

  return (
    <div className="glass-card flex flex-col gap-2 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input className="h-10" placeholder="slug (auto)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Input className="h-10" placeholder="Name (English — root)" value={en} onChange={(e) => setEn(e.target.value)} />
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

      {/* extra languages by ISO code */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-muted">Назви іншими мовами (ISO-код: uk, de, es…):</span>
        {langs.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="h-9 w-16"
              placeholder="uk"
              value={l.code}
              onChange={(e) => setLang(i, { code: e.target.value.toLowerCase() })}
            />
            <Input
              className="h-9 flex-1"
              placeholder="назва цією мовою"
              value={l.name}
              onChange={(e) => setLang(i, { name: e.target.value })}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLangs((ls) => ls.filter((_, j) => j !== i))}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => setLangs((ls) => [...ls, { code: "", name: "" }])}
        >
          <Plus size={13} /> мова
        </Button>
      </div>

      {!presetParentId && parents.length > 0 && (
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="glass-card h-10 rounded-xl px-2 text-sm text-fg outline-none"
        >
          <option value="">— без батька (верхній рівень) —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              вкласти в: {p.title}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending || !en} onClick={submit}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {presetParentId ? "Створити підкатегорію" : "Створити категорію"}
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
