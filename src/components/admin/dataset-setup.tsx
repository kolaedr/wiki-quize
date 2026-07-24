"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countClassAction,
  probeClassAction,
  searchClassesAction,
  searchPropertiesAction,
  setupTopicAction,
  type ActionResult,
  type ProbeResult,
} from "@/lib/admin/actions";
import type {
  ClassCandidate,
  Filter,
  ProbeField,
  PropertyCandidate,
} from "@/lib/ingest/probe";
import type { TopicFieldDef } from "@/lib/ingest/def";
import { ImportRunner } from "@/components/admin/import-runner";

/** human-readable field kinds */
const KIND_UK: Record<string, string> = {
  image: "зображення",
  number: "число",
  date: "дата/рік",
  entityRefList: "звʼязок (інша сутність)",
};

/** extra languages that can be pulled after the English root */
const EXTRA_LOCALES = [
  { code: "uk", label: "Українська" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

function roleFromLabel(label: string, prop: string): string {
  const words = label.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  let role = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("")
    .slice(0, 30);
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(role)) role = `f${prop}`;
  return role;
}

/** A narrowing filter with human labels for display (mapped to Filter on send). */
interface ActiveFilter {
  prop: string;
  valueQid: string;
  propLabel: string;
  valueLabel: string;
}

function fieldsFrom(props: ProbeField[]): TopicFieldDef[] {
  const out: TopicFieldDef[] = [];
  for (const p of props) {
    if (!p.kind) continue;
    let role = roleFromLabel(p.label, p.prop);
    if (out.some((f) => f.role === role)) role = `${role}${p.prop}`;
    out.push({ role, kind: p.kind, prop: p.prop });
  }
  return out;
}

/**
 * Optional narrowing filters: search a PROPERTY by word (citizenship → P27),
 * then a VALUE by word (Ukraine → Q212). Each filter ANDs into the query, so a
 * global class (human) can be sliced deliberately. No QIDs typed by hand.
 */
function FilterBuilder({
  filters,
  onChange,
}: {
  filters: ActiveFilter[];
  onChange: (f: ActiveFilter[]) => void;
}) {
  const [propQuery, setPropQuery] = useState("");
  const [propCands, setPropCands] = useState<PropertyCandidate[] | null>(null);
  const [pickedProp, setPickedProp] = useState<PropertyCandidate | null>(null);
  const [valQuery, setValQuery] = useState("");
  const [valCands, setValCands] = useState<ClassCandidate[] | null>(null);
  const [searchingProp, startProp] = useTransition();
  const [searchingVal, startVal] = useTransition();

  const runPropSearch = () =>
    startProp(async () => {
      const r = await searchPropertiesAction(propQuery);
      setPropCands(r.ok ? (r.properties ?? []) : []);
    });
  const runValSearch = () =>
    startVal(async () => {
      const r = await searchClassesAction(valQuery);
      setValCands(r.ok ? (r.classes ?? []) : []);
    });

  const addFilter = (val: ClassCandidate) => {
    if (!pickedProp) return;
    if (filters.some((f) => f.prop === pickedProp.pid && f.valueQid === val.qid)) return;
    onChange([
      ...filters,
      { prop: pickedProp.pid, valueQid: val.qid, propLabel: pickedProp.label, valueLabel: val.label },
    ]);
    // reset the value step, keep the property for adding another value
    setValQuery("");
    setValCands(null);
  };
  const removeFilter = (i: number) => onChange(filters.filter((_, idx) => idx !== i));

  return (
    <details className="rounded-lg border border-line/60 p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-fg">
        Фільтри (опційно) — звузити клас
      </summary>
      <p className="mt-1 text-[11px] text-muted">
        Напр. клас «людина» + фільтр «громадянство = Україна». Кожен фільтр звужує
        (AND). Спершу знайди властивість, потім значення.
      </p>

      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {filters.map((f, i) => (
            <span
              key={`${f.prop}-${f.valueQid}`}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-accent"
            >
              {f.propLabel} = {f.valueLabel}
              <span className="text-[10px] opacity-70">
                {f.prop}={f.valueQid}
              </span>
              <button type="button" aria-label="прибрати" onClick={() => removeFilter(i)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* step 1: property */}
      <div className="mt-3 flex items-center gap-2">
        <Input
          className="h-9 flex-1"
          placeholder="Властивість: напр. «громадянство», «професія»"
          value={propQuery}
          onChange={(e) => setPropQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runPropSearch()}
        />
        <Button size="sm" variant="ghost" disabled={searchingProp || !propQuery.trim()} onClick={runPropSearch}>
          {searchingProp ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        </Button>
      </div>
      {propCands && (
        <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-line/50">
          {propCands.length === 0 && <p className="p-2 text-[11px] text-muted">Нічого не знайшлось.</p>}
          {propCands.map((p) => (
            <button
              key={p.pid}
              type="button"
              onClick={() => {
                setPickedProp(p);
                setPropCands(null);
              }}
              className="flex w-full items-center gap-2 border-t border-line/40 p-2 text-left first:border-t-0 hover:bg-accent-soft/40"
            >
              <span className="flex-1">
                <span className="font-semibold">{p.label}</span>{" "}
                <span className="text-muted">({p.pid})</span>
                {p.description && <span className="block text-[11px] text-muted">{p.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* step 2: value (enabled once a property is chosen) */}
      {pickedProp && (
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] text-muted">
            Властивість: <span className="font-semibold text-accent">{pickedProp.label}</span> (
            {pickedProp.pid}) — тепер знайди значення:
          </span>
          <div className="flex items-center gap-2">
            <Input
              className="h-9 flex-1"
              placeholder="Значення: напр. «Україна», «науковець»"
              value={valQuery}
              onChange={(e) => setValQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runValSearch()}
            />
            <Button size="sm" variant="ghost" disabled={searchingVal || !valQuery.trim()} onClick={runValSearch}>
              {searchingVal ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            </Button>
          </div>
          {valCands && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-line/50">
              {valCands.length === 0 && <p className="p-2 text-[11px] text-muted">Нічого не знайшлось.</p>}
              {valCands.map((v) => (
                <button
                  key={v.qid}
                  type="button"
                  onClick={() => addFilter(v)}
                  className="flex w-full items-center gap-2 border-t border-line/40 p-2 text-left first:border-t-0 hover:bg-accent-soft/40"
                >
                  <span className="flex-1">
                    <span className="font-semibold">{v.label}</span>{" "}
                    <span className="text-muted">({v.qid})</span>
                    {v.description && <span className="block text-[11px] text-muted">{v.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

/**
 * Dataset SETUP. Root probe (English) is LIGHT: one COUNT + one sample entity
 * with its fields. Tick which fields to pull and which extra languages to fill
 * (English is always the root; more can be added later via a re-sync). Only
 * then does the heavy batch import run.
 */
export function DatasetSetup({ topicSlug }: { topicSlug: string }) {
  const router = useRouter();
  const [classItems, setClassItems] = useState<ClassCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ClassCandidate[] | null>(null);
  const [manual, setManual] = useState("");
  const [threshold, setThreshold] = useState(30);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [locales, setLocales] = useState<Set<string>>(new Set(["uk"]));
  const [searching, startSearch] = useTransition();
  const [probing, startProbe] = useTransition();
  const [counting, startCount] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saved, setSaved] = useState(false); // config saved → run batched import

  const classCsv = classItems.map((c) => c.qid).join(", ");
  const classQids = classItems.map((c) => c.qid);
  const filterPayload: Filter[] = filters.map((f) => ({ prop: f.prop, valueQid: f.valueQid }));
  const addClass = (c: ClassCandidate) =>
    setClassItems((xs) => (xs.some((x) => x.qid === c.qid) ? xs : [...xs, c]));

  const runSearch = () =>
    startSearch(async () => {
      setResult(null);
      const r = await searchClassesAction(query);
      setCandidates(r.ok ? (r.classes ?? []) : []);
    });

  const runProbe = () =>
    startProbe(async () => {
      setResult(null);
      const r = await probeClassAction(classCsv, threshold, filterPayload);
      setProbe(r);
      setTotal(r.total ?? null);
      if (r.ok && r.fields) {
        // default: only image fields (name is always pulled); rest is admin's choice
        setPicked(new Set(r.fields.filter((f) => f.kind === "image").map((f) => f.prop)));
      }
    });

  const recount = () =>
    startCount(async () => {
      const r = await countClassAction(classCsv, threshold, filterPayload);
      if (r.ok) setTotal(r.total ?? null);
    });

  const addManual = () => {
    for (const qid of manual.split(",").map((s) => s.trim().toUpperCase()).filter((q) => /^Q\d+$/.test(q)))
      addClass({ qid, label: qid });
    setManual("");
  };

  const togglePick = (prop: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(prop);
      else n.delete(prop);
      return n;
    });

  const toggleLocale = (code: string, on: boolean) =>
    setLocales((s) => {
      const n = new Set(s);
      if (on) n.add(code);
      else n.delete(code);
      return n;
    });

  const submit = () =>
    start(async () => {
      const fields = fieldsFrom((probe?.fields ?? []).filter((f) => picked.has(f.prop) && f.kind));
      const r = await setupTopicAction(
        topicSlug,
        classQids,
        threshold,
        fields,
        ["en", ...locales],
        filterPayload,
      );
      setResult(r);
      if (r.ok) setSaved(true); // switches to the batched import runner below
    });

  const fields = probe?.ok ? (probe.fields ?? []) : null;

  return (
    <div className="glass-card flex flex-col gap-3 p-4">
      {/* class search */}
      <div className="flex items-center gap-2">
        <Input
          className="h-10 flex-1"
          placeholder="Що збираємо? напр. «країна», «модель авто», «замок»"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <Button size="sm" variant="secondary" disabled={searching || !query.trim()} onClick={runSearch}>
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          Знайти клас
        </Button>
      </div>

      {candidates && (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-line/60">
          {candidates.length === 0 && (
            <p className="p-3 text-xs text-muted">Нічого не знайшлось — спробуй інше слово.</p>
          )}
          {candidates.map((c) => {
            const isPicked = classItems.some((x) => x.qid === c.qid);
            return (
              <button
                key={c.qid}
                type="button"
                onClick={() => addClass(c)}
                disabled={isPicked}
                className="flex w-full items-center gap-2 border-t border-line/40 p-2 text-left text-xs first:border-t-0 hover:bg-accent-soft/40 disabled:opacity-40"
              >
                <span className="flex-1">
                  <span className="font-semibold">{c.label}</span>{" "}
                  <span className="text-muted">({c.qid})</span>
                  {c.description && <span className="block text-[11px] text-muted">{c.description}</span>}
                </span>
                {isPicked && <span className="text-[11px] text-success">додано</span>}
              </button>
            );
          })}
        </div>
      )}

      {classItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Класи:</span>
          {classItems.map((c) => (
            <span
              key={c.qid}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent"
            >
              {c.label}
              <span className="text-[10px] opacity-70">{c.qid}</span>
              <button
                type="button"
                aria-label="прибрати"
                onClick={() => setClassItems((xs) => xs.filter((x) => x.qid !== c.qid))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Ввести QID вручну</summary>
        <div className="mt-2 flex items-center gap-2">
          <Input
            className="h-9 flex-1"
            placeholder="Q6256"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
          />
          <Button size="sm" variant="ghost" onClick={addManual}>
            Додати
          </Button>
        </div>
      </details>

      {/* optional narrowing filters (e.g. citizenship = Ukraine) */}
      <FilterBuilder filters={filters} onChange={setFilters} />

      <Button size="sm" className="self-start" disabled={probing || classItems.length === 0} onClick={runProbe}>
        {probing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        Розвідка (англійська)
      </Button>

      {probe && !probe.ok && <p className="text-xs text-danger">{probe.message}</p>}
      {probe?.ok && probe.message && <p className="text-xs text-amber-500">{probe.message}</p>}

      {fields && (
        <>
          {/* total + threshold */}
          <div className="rounded-xl bg-accent-soft/40 p-3 text-xs">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
              <span>
                Скільки буде: <span className="font-semibold text-fg">{total ?? "—"}</span> айтемів при
                порозі
              </span>
              <Input
                type="number"
                className="h-7 w-16"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              />
              <Button size="sm" variant="ghost" disabled={counting} onClick={recount}>
                {counting ? <Loader2 size={12} className="animate-spin" /> : "перерахувати"}
              </Button>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              поріг = скільки вікі-статей має айтем (проксі відомості)
            </p>
          </div>

          {/* fields = checkboxes discovered across the top items */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg">Які поля тягнути?</span>
            <p className="text-[11px] text-muted">
              Назва тягнеться завжди. Зображення позначені за замовчуванням; решту
              обирай за потреби. «Заповнено» = у скількох із топ-{probe?.sampleSize ?? 3}
              айтемів є поле.
              {probe?.sampleLabels?.length
                ? ` Приклади з: ${probe.sampleLabels.join(", ")}.`
                : ""}
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-line/60">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg/90 text-muted backdrop-blur">
                  <tr>
                    <th className="p-2"> </th>
                    <th className="p-2">Поле</th>
                    <th className="p-2">Тип</th>
                    <th className="p-2">Заповнено</th>
                    <th className="p-2">Приклад</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((p) => (
                    <tr
                      key={p.prop}
                      onClick={() => p.kind && togglePick(p.prop, !picked.has(p.prop))}
                      className={`border-t border-line/40 ${p.kind ? "cursor-pointer hover:bg-accent-soft/40" : "opacity-40"}`}
                    >
                      <td className="p-2 align-top">
                        <input type="checkbox" readOnly checked={picked.has(p.prop)} disabled={!p.kind} />
                      </td>
                      <td className="p-2 align-top">
                        <span className="font-medium text-fg">{p.label}</span>{" "}
                        <span className="text-[10px] text-muted">{p.prop}</span>
                      </td>
                      <td className="p-2 align-top">{p.kind ? KIND_UK[p.kind] : "—"}</td>
                      <td className="p-2 align-top text-muted">{Math.round(p.coverage * 100)}%</td>
                      <td className="p-2 align-top text-muted">
                        {p.exampleImage ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Commons thumb preview
                          <img
                            src={p.exampleImage}
                            alt=""
                            className="h-10 w-14 rounded object-contain"
                          />
                        ) : (
                          <span className="block max-w-40 truncate">{p.example ?? ""}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* languages: English root + optional extras */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg">Мови даних</span>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                <input type="checkbox" checked disabled /> English (root)
              </label>
              {EXTRA_LOCALES.map((l) => (
                <label key={l.code} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={locales.has(l.code)}
                    onChange={(e) => toggleLocale(l.code, e.target.checked)}
                  />
                  {l.label}
                </label>
              ))}
            </div>
            <span className="text-[11px] text-muted">
              English обовʼязкова; решту можна доімпортувати пізніше синхронізацією.
            </span>
          </div>

          {saved ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-success">Конфіг збережено — тягну дані батчами:</span>
              <ImportRunner topicSlug={topicSlug} autoStart />
              <p className="text-[11px] text-muted">
                Іде по черзі, батч за батчем — не закривай сторінку до завершення.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button disabled={pending || picked.size === 0} onClick={submit}>
                {pending && <Loader2 size={14} className="animate-spin" />}
                Зберегти й імпортувати
              </Button>
              {result && !result.ok && <span className="text-xs text-danger">{result.message}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
