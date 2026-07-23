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
  setupTopicAction,
  type ActionResult,
  type ProbeResult,
} from "@/lib/admin/actions";
import type { ClassCandidate, ProbeField } from "@/lib/ingest/probe";
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
  const [locales, setLocales] = useState<Set<string>>(new Set(["uk"]));
  const [searching, startSearch] = useTransition();
  const [probing, startProbe] = useTransition();
  const [counting, startCount] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saved, setSaved] = useState(false); // config saved → run batched import

  const classCsv = classItems.map((c) => c.qid).join(", ");
  const classQids = classItems.map((c) => c.qid);
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
      const r = await probeClassAction(classCsv, threshold);
      setProbe(r);
      setTotal(r.total ?? null);
      if (r.ok && r.sample) {
        setPicked(new Set(r.sample.fields.filter((f) => f.kind).map((f) => f.prop)));
      }
    });

  const recount = () =>
    startCount(async () => {
      const r = await countClassAction(classCsv, threshold);
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
      const fields = fieldsFrom((probe?.sample?.fields ?? []).filter((f) => picked.has(f.prop) && f.kind));
      const r = await setupTopicAction(topicSlug, classQids, threshold, fields, ["en", ...locales]);
      setResult(r);
      if (r.ok) setSaved(true); // switches to the batched import runner below
    });

  const sample = probe?.ok ? probe.sample : null;

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

      <Button size="sm" className="self-start" disabled={probing || classItems.length === 0} onClick={runProbe}>
        {probing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        Розвідка (англійська)
      </Button>

      {probe && !probe.ok && <p className="text-xs text-danger">{probe.message}</p>}
      {probe?.ok && probe.message && <p className="text-xs text-amber-500">{probe.message}</p>}

      {sample && (
        <>
          {/* sample entity + total */}
          <div className="rounded-xl bg-accent-soft/40 p-3 text-xs">
            <p className="font-semibold text-fg">
              Приклад: {sample.label}{" "}
              <span className="font-normal text-muted">({sample.qid})</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
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
              поріг = скільки вікі-статей має айтем (проксі відомості; популярність прикладу:{" "}
              {sample.popularity})
            </p>
          </div>

          {/* fields = checkboxes from the sample entity */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg">Які поля тягнути?</span>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-line/60">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg/90 text-muted backdrop-blur">
                  <tr>
                    <th className="p-2"> </th>
                    <th className="p-2">Поле</th>
                    <th className="p-2">Тип</th>
                    <th className="p-2">Приклад значення</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.fields.map((p) => (
                    <tr
                      key={p.prop}
                      onClick={() => p.kind && togglePick(p.prop, !picked.has(p.prop))}
                      className={`border-t border-line/40 ${p.kind ? "cursor-pointer hover:bg-accent-soft/40" : "opacity-40"}`}
                    >
                      <td className="p-2">
                        <input type="checkbox" readOnly checked={picked.has(p.prop)} disabled={!p.kind} />
                      </td>
                      <td className="p-2">
                        {p.label} <span className="text-muted">({p.prop})</span>
                      </td>
                      <td className="p-2">{p.kind ? KIND_UK[p.kind] : "—"}</td>
                      <td className="max-w-40 truncate p-2 text-muted">{p.example ?? ""}</td>
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
