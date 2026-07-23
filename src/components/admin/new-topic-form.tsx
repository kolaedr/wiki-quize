"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTopicAction, type ActionResult } from "@/lib/admin/actions";
import { DEF_TEMPLATES, type TopicDef, type TopicFieldDef } from "@/lib/ingest/def";

const ICONS = ["landmark", "scale", "car", "globe", "flag", "shield", "languages", "users", "deck"];
const KINDS: TopicFieldDef["kind"][] = ["image", "entityRefList", "number", "date"];

/**
 * NO-CODE topic builder: Wikidata class + field mapping → SPARQL is generated,
 * games are auto-created from field kinds. "Landmarks" = one click on a template.
 */
export function NewTopicForm() {
  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleUk, setTitleUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [classQids, setClassQids] = useState("");
  const [sitelinksMin, setSitelinksMin] = useState(40);
  const [fields, setFields] = useState<TopicFieldDef[]>([
    { role: "photo", kind: "image", prop: "P18", required: true },
  ]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const applyTemplate = (t: TopicDef) => {
    setSlug(t.slug);
    setTitleEn(t.title.en);
    setTitleUk(t.title.uk ?? "");
    setIcon(t.icon);
    setClassQids(t.classQids.join(", "));
    setSitelinksMin(t.sitelinksMin);
    setFields(t.fields.map((f) => ({ ...f })));
    setResult(null);
  };

  const submit = () =>
    start(async () => {
      const def: TopicDef = {
        slug: slug.trim(),
        title: { en: titleEn.trim(), ...(titleUk.trim() ? { uk: titleUk.trim() } : {}) },
        icon,
        classQids: classQids.split(",").map((s) => s.trim()).filter(Boolean),
        sitelinksMin: Number(sitelinksMin) || 0,
        limit: 500,
        fields,
      };
      setResult(await createTopicAction(def));
    });

  const setField = (i: number, patch: Partial<TopicFieldDef>) =>
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      {/* one-click templates */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Шаблони:</span>
        {DEF_TEMPLATES.map((t) => (
          <Button key={t.slug} size="sm" variant="secondary" onClick={() => applyTemplate(t)}>
            <Wand2 size={12} />
            {t.title.uk ?? t.title.en}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="slug (landmarks)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="glass-card h-12 rounded-xl px-3 text-sm text-fg outline-none"
        >
          {ICONS.map((i) => (
            <option key={i} value={i}>іконка: {i}</option>
          ))}
        </select>
        <Input placeholder="Назва (EN)" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        <Input placeholder="Назва (UK)" value={titleUk} onChange={(e) => setTitleUk(e.target.value)} />
        <Input placeholder="Класи Wikidata (Q570116, Q839954)" value={classQids} onChange={(e) => setClassQids(e.target.value)} />
        <Input
          type="number"
          placeholder="мін. sitelinks"
          value={sitelinksMin}
          onChange={(e) => setSitelinksMin(Number(e.target.value))}
        />
      </div>

      {/* field mapping rows */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">
          Поля (роль → властивість Wikidata). З типів полів автоматично зберуться ігри:
          image → вгадайка, entityRef → «чиє це?» в обидва боки, number → більше/менше, date → правда/ні.
        </span>
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input className="h-10 flex-1" placeholder="роль (photo)" value={f.role} onChange={(e) => setField(i, { role: e.target.value })} />
            <Input className="h-10 w-24" placeholder="P18" value={f.prop} onChange={(e) => setField(i, { prop: e.target.value })} />
            <select
              value={f.kind}
              onChange={(e) => setField(i, { kind: e.target.value as TopicFieldDef["kind"] })}
              className="glass-card h-10 rounded-xl px-2 text-xs text-fg outline-none"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={!!f.required}
                onChange={(e) => setField(i, { required: e.target.checked })}
              />
              обов'язк.
            </label>
            <Button size="icon" variant="ghost" onClick={() => setFields((x) => x.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => setFields((f) => [...f, { role: "", kind: "image", prop: "" }])}
        >
          <Plus size={13} /> Додати поле
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={pending || !slug || !titleEn || !classQids} onClick={submit}>
          {pending && <Loader2 size={14} className="animate-spin" />}
          Створити й імпортувати
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
