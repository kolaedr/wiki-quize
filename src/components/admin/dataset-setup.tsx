"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  probeClassAction,
  searchClassesAction,
  setupTopicAction,
  type ActionResult,
  type ProbeResult,
} from "@/lib/admin/actions";
import type { ClassCandidate, ProbeProperty } from "@/lib/ingest/probe";
import type { TopicFieldDef } from "@/lib/ingest/def";

/** "country of origin" → "countryOfOrigin" (must satisfy the role regex). */
function roleFromLabel(label: string, prop: string): string {
  const words = label.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  let role = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("")
    .slice(0, 30);
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(role)) role = `f${prop}`;
  return role;
}

/** Build field defs from picked properties, with unique roles. */
function fieldsFrom(props: ProbeProperty[]): TopicFieldDef[] {
  const out: TopicFieldDef[] = [];
  for (const p of props) {
    if (!p.kind) continue;
    let role = roleFromLabel(p.label, p.prop);
    if (out.some((f) => f.role === role)) role = `${role}${p.prop}`;
    out.push({ role, kind: p.kind, prop: p.prop });
  }
  return out;
}

const countAt = (dist: { sitelinks: number; n: number }[], t: number) =>
  dist.reduce((s, d) => (d.sitelinks >= t ? s + d.n : s), 0);

/**
 * Dataset SETUP (dataset-first flow): find the Wikidata class by word, probe
 * it (item counts by threshold, filled properties with coverage, a sample
 * entity), TICK which fields to pull, then import — all on the dataset page.
 */
export function DatasetSetup({ topicSlug }: { topicSlug: string }) {
  const router = useRouter();
  const [classItems, setClassItems] = useState<ClassCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ClassCandidate[] | null>(null);
  const [manual, setManual] = useState("");
  const [sitelinksMin, setSitelinksMin] = useState(30);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set()); // prop QIDs to pull
  const [searching, startSearch] = useTransition();
  const [probing, startProbe] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const classQids = classItems.map((c) => c.qid);
  const addClass = (c: ClassCandidate) =>
    setClassItems((xs) => (xs.some((x) => x.qid === c.qid) ? xs : [...xs, c]));

  const liveCount = useMemo(
    () => (probe?.distribution ? countAt(probe.distribution, sitelinksMin) : null),
    [probe, sitelinksMin],
  );

  const runSearch = () =>
    startSearch(async () => {
      setResult(null);
      const r = await searchClassesAction(query);
      setCandidates(r.ok ? (r.classes ?? []) : []);
    });

  const runProbe = () =>
    startProbe(async () => {
      setResult(null);
      const r = await probeClassAction(classQids.join(", "));
      setProbe(r);
      // pre-tick supported fields present on most sampled items
      if (r.ok && r.properties) {
        setPicked(
          new Set(r.properties.filter((p) => p.kind && p.coverage >= 0.6).map((p) => p.prop)),
        );
      }
    });

  const addManual = () => {
    for (const qid of manual.split(",").map((s) => s.trim().toUpperCase()).filter((q) => /^Q\d+$/.test(q)))
      addClass({ qid, label: qid });
    setManual("");
  };

  const togglePick = (prop: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(prop)) n.delete(prop);
      else n.add(prop);
      return n;
    });

  const submit = () =>
    start(async () => {
      const props = (probe?.properties ?? []).filter((p) => picked.has(p.prop) && p.kind);
      const fields = fieldsFrom(props);
      const r = await setupTopicAction(topicSlug, classQids, Number(sitelinksMin) || 0, fields);
      setResult(r);
      if (r.ok) router.refresh(); // page now shows imported data
    });

  const supported = (probe?.properties ?? []).filter((p) => p.kind || p.coverage >= 0.3);

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
        Розвідка
      </Button>

      {probe && !probe.ok && <p className="text-xs text-danger">{probe.message}</p>}
      {probe?.ok && probe.message && <p className="text-xs text-amber-500">{probe.message}</p>}

      {probe?.ok && probe.distribution && (
        <>
          {/* sample entity — one real item, prominent */}
          {probe.sample && (
            <div className="rounded-xl bg-accent-soft/40 p-3 text-xs">
              <p className="font-semibold text-fg">
                Приклад айтема: {probe.sample.label}{" "}
                <span className="font-normal text-muted">
                  ({probe.sample.qid}, {probe.sample.sitelinks} мовних версій)
                </span>
              </p>
              {Object.entries(probe.sample.values).length > 0 && (
                <p className="mt-1 text-muted">
                  {Object.entries(probe.sample.values)
                    .slice(0, 6)
                    .map(([p, vals]) => `${p}: ${vals.join(", ")}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* threshold picker */}
          <div className="flex flex-col gap-1 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-muted">Поріг «відомості» (sitelinks — у скількох мовах є стаття):</span>
              <Input
                type="number"
                className="h-8 w-20"
                value={sitelinksMin}
                onChange={(e) => setSitelinksMin(Number(e.target.value) || 0)}
              />
            </label>
            <span className="font-semibold text-fg">
              При порозі {sitelinksMin} → {liveCount} айтемів
            </span>
            <span className="text-muted">
              Інші пороги:{" "}
              {[15, 30, 60, 100].map((t) => `${t}→${countAt(probe.distribution!, t)}`).join(", ")}
            </span>
          </div>

          {/* fields = checkboxes (what to pull). Pre-ticked from the API. */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg">Які поля тягнути? (галочки)</span>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-line/60">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-bg/90 text-muted backdrop-blur">
                  <tr>
                    <th className="p-2"> </th>
                    <th className="p-2">Поле</th>
                    <th className="p-2">Тип</th>
                    <th className="p-2">Заповнено</th>
                  </tr>
                </thead>
                <tbody>
                  {supported.map((p) => (
                    <tr
                      key={p.prop}
                      onClick={() => p.kind && togglePick(p.prop)}
                      className={`border-t border-line/40 ${p.kind ? "cursor-pointer hover:bg-accent-soft/40" : "opacity-40"}`}
                    >
                      <td className="p-2">
                        <input type="checkbox" readOnly checked={picked.has(p.prop)} disabled={!p.kind} />
                      </td>
                      <td className="p-2">
                        {p.label} <span className="text-muted">({p.prop})</span>
                      </td>
                      <td className="p-2">{p.kind ?? "—"}</td>
                      <td className="p-2">{Math.round(p.coverage * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={pending || picked.size === 0} onClick={submit}>
              {pending && <Loader2 size={14} className="animate-spin" />}
              Імпортувати обрані поля
            </Button>
            {result && (
              <span className={`text-xs ${result.ok ? "text-success" : "text-danger"}`}>
                {result.message}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
