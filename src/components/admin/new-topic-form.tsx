"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTopicAction,
  probeClassAction,
  type ActionResult,
  type ProbeResult,
} from "@/lib/admin/actions";
import { DEF_TEMPLATES, type TopicDef, type TopicFieldDef } from "@/lib/ingest/def";

const ICONS = ["landmark", "scale", "car", "globe", "flag", "shield", "languages", "users", "deck"];
const KINDS: TopicFieldDef["kind"][] = ["image", "entityRefList", "number", "date"];

/** "country of origin" → "countryOfOrigin" (must satisfy the role regex). */
function roleFromLabel(label: string, prop: string): string {
  const words = label.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  let role = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("")
    .slice(0, 30);
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(role)) role = `f${prop}`; // fallback: fP18
  return role;
}

/** count of items at a sitelinks threshold, from the probe distribution */
const countAt = (dist: { sitelinks: number; n: number }[], t: number) =>
  dist.reduce((s, d) => (d.sitelinks >= t ? s + d.n : s), 0);

/**
 * PIPELINE v2 topic builder — two steps instead of typing P-ids from memory:
 * 1) РОЗВІДКА: enter the Wikidata class → live item count per threshold,
 *    a table of REALLY-filled properties (type + coverage %), a sample entity;
 * 2) the admin picks properties with CHECKBOXES → fields; full import runs;
 *    games are created UNLISTED — publishing is an explicit button in "Ігри".
 * Manual field rows remain as the advanced editor below.
 */
export function NewTopicForm() {
  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleUk, setTitleUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [classQids, setClassQids] = useState("");
  const [sitelinksMin, setSitelinksMin] = useState(40);
  const [fields, setFields] = useState<TopicFieldDef[]>([]);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, startProbe] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const liveCount = useMemo(
    () => (probe?.distribution ? countAt(probe.distribution, sitelinksMin) : null),
    [probe, sitelinksMin],
  );

  const runProbe = () =>
    startProbe(async () => {
      setResult(null);
      setProbe(await probeClassAction(classQids));
    });

  const applyTemplate = (t: TopicDef) => {
    setSlug(t.slug);
    setTitleEn(t.title.en);
    setTitleUk(t.title.uk ?? "");
    setIcon(t.icon);
    setClassQids(t.classQids.join(", "));
    setSitelinksMin(t.sitelinksMin);
    setFields(t.fields.map((f) => ({ ...f })));
    setProbe(null);
    setResult(null);
  };

  const toggleProp = (p: { prop: string; label: string; kind: TopicFieldDef["kind"] | null }) => {
    if (!p.kind) return;
    setFields((f) => {
      const i = f.findIndex((x) => x.prop === p.prop);
      if (i >= 0) return f.filter((_, j) => j !== i);
      const role = roleFromLabel(p.label, p.prop);
      const unique = f.some((x) => x.role === role) ? `${role}${p.prop}` : role;
      return [...f, { role: unique, kind: p.kind!, prop: p.prop }];
    });
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

      {/* STEP 1 — розвідка класу */}
      <div className="flex flex-col gap-2 rounded-xl border border-line/60 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Крок 1 · Розвідка
        </span>
        <div className="flex items-center gap-2">
          <Input
            className="h-10 flex-1"
            placeholder="Класи Wikidata (Q3231690, Q570116)"
            value={classQids}
            onChange={(e) => setClassQids(e.target.value)}
          />
          <Button size="sm" disabled={probing || !classQids.trim()} onClick={runProbe}>
            {probing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Розвідка
          </Button>
        </div>

        {probe && !probe.ok && <p className="text-xs text-danger">{probe.message}</p>}

        {probe?.ok && probe.distribution && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-muted">
                мін. sitelinks
                <Input
                  type="number"
                  className="h-8 w-20"
                  value={sitelinksMin}
                  onChange={(e) => setSitelinksMin(Number(e.target.value) || 0)}
                />
              </label>
              <span className="font-semibold text-fg">
                → {liveCount} айтемів при порозі {sitelinksMin}
              </span>
              <span className="text-muted">
                {[15, 30, 60, 100]
                  .map((t) => `${t}: ${countAt(probe.distribution!, t)}`)
                  .join(" · ")}
              </span>
            </div>

            {/* property table with checkboxes */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-line/60">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg/90 text-muted backdrop-blur">
                  <tr>
                    <th className="p-2"> </th>
                    <th className="p-2">Властивість</th>
                    <th className="p-2">Тип</th>
                    <th className="p-2">Покриття (топ-{probe.sampleSize})</th>
                  </tr>
                </thead>
                <tbody>
                  {(probe.properties ?? [])
                    .filter((p) => p.kind || p.coverage >= 0.3)
                    .map((p) => {
                      const checked = fields.some((f) => f.prop === p.prop);
                      return (
                        <tr
                          key={p.prop}
                          className={`border-t border-line/40 ${p.kind ? "cursor-pointer hover:bg-accent-soft/40" : "opacity-40"}`}
                          onClick={() => toggleProp(p)}
                        >
                          <td className="p-2">
                            <input type="checkbox" readOnly checked={checked} disabled={!p.kind} />
                          </td>
                          <td className="p-2">
                            {p.label} <span className="text-muted">({p.prop})</span>
                          </td>
                          <td className="p-2">{p.kind ?? "не підтримується"}</td>
                          <td className="p-2">{Math.round(p.coverage * 100)}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {probe.sample && (
              <p className="text-[11px] leading-4 text-muted">
                Приклад: <span className="text-fg">{probe.sample.label}</span> (
                {probe.sample.qid}, sitelinks {probe.sample.sitelinks}) ·{" "}
                {Object.entries(probe.sample.values)
                  .slice(0, 5)
                  .map(([p, vals]) => `${p}: ${vals.join(", ")}`)
                  .join(" · ")}
              </p>
            )}
          </>
        )}
      </div>

      {/* STEP 2 — назва теми і поля */}
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        Крок 2 · Тема і поля
      </span>
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
      </div>

      {/* field rows: filled by the checkboxes above, editable as advanced mode */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">
          Поля (з розвідки або вручну). З типів полів зберуться ігри-кандидати
          (unlisted): image → вгадайка, entityRef → «чиє це?» в обидва боки,
          number → більше/менше, date → правда/ні.
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
        <Button
          disabled={pending || !slug || !titleEn || !classQids || fields.length === 0}
          onClick={submit}
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          Створити й імпортувати
        </Button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>
            {result.message}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Ігри створюються як unlisted — переглянь у розділі «Ігри» і опублікуй кнопкою.
      </p>
    </div>
  );
}
