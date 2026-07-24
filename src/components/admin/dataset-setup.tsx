"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countClassAction,
  createDatasetAction,
  probeClassAction,
  probeFacetsAction,
  roleCheckAction,
  searchClassesAction,
  searchPropertiesAction,
  setupTopicAction,
  type ActionResult,
  type ProbeResult,
} from "@/lib/admin/actions";
import type {
  ClassCandidate,
  Facet,
  Filter,
  ProbeField,
  PropertyCandidate,
} from "@/lib/ingest/probe";
import type { TopicFieldDef } from "@/lib/ingest/def";
import { ImportRunner } from "@/components/admin/import-runner";
import { ICON_NAMES } from "@/components/game-icon";

export interface DatasetCategoryOption {
  id: string;
  title: string;
}

/** human-readable field kinds */
const KIND_UK: Record<string, string> = {
  image: "зображення",
  number: "число",
  date: "дата/рік",
  entityRefList: "звʼязок (інша сутність)",
  text: "текст (напр. символ)",
};

/** extra languages that can be pulled after the English root */
const EXTRA_LOCALES = [
  { code: "uk", label: "Українська" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
];

/** Image props that are noise for games (maps, locators) — not proposed. */
const NOISY_IMAGE_PROPS = new Set(["P242", "P1943", "P15", "P181", "P1846", "P1621", "P14"]);
/** Preferred primary image by priority: flag → logo → photo → coat of arms. */
const PRIMARY_IMAGE_ORDER = ["P41", "P154", "P18", "P94"];

/** Default tick: just the ONE primary image (name is always pulled); rest opt-in. */
function defaultPickedProps(fields: ProbeField[]): string[] {
  const images = fields.filter((f) => f.kind === "image" && !NOISY_IMAGE_PROPS.has(f.prop));
  for (const p of PRIMARY_IMAGE_ORDER) {
    const hit = images.find((f) => f.prop === p);
    if (hit) return [hit.prop];
  }
  return images.slice(0, 1).map((f) => f.prop);
}

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
export function DatasetSetup({
  topicSlug,
  categoryId,
  categoryOptions,
}: {
  /** present = configure an existing draft; absent = CREATE a new dataset */
  topicSlug?: string;
  categoryId?: string;
  categoryOptions?: DatasetCategoryOption[];
}) {
  const isCreate = !topicSlug;
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameUk, setNameUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [catId, setCatId] = useState(categoryId ?? "");
  const [classItems, setClassItems] = useState<ClassCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ClassCandidate[] | null>(null);
  const [manual, setManual] = useState("");
  const [threshold, setThreshold] = useState(30);
  const [minCoverage, setMinCoverage] = useState(70); // hide sparse fields by default
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [photoOnly, setPhotoOnly] = useState(false);
  const [difficultyBy, setDifficultyBy] = useState(""); // "" = popularity
  const [facets, setFacets] = useState<Facet[] | null>(null);
  const [loadingFacets, startFacets] = useTransition();
  const [roleHint, setRoleHint] = useState<
    { qid: string; label: string; occupation: number; position: number } | null
  >(null);
  const [locales, setLocales] = useState<Set<string>>(new Set(["uk"]));
  const [searching, startSearch] = useTransition();
  const [probing, startProbe] = useTransition();
  const [counting, startCount] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saved, setSaved] = useState(false); // config saved → run batched import

  const classCsv = classItems.map((c) => c.qid).join(", ");
  const classQids = classItems.map((c) => c.qid);
  const filterPayload: Filter[] = [
    ...filters.map((f) => ({ prop: f.prop, valueQid: f.valueQid })),
    ...(photoOnly ? [{ prop: "P18", valueQid: "" }] : []), // "лише з фото"
  ];

  const loadFacets = () =>
    startFacets(async () => {
      const r = await probeFacetsAction(
        classCsv,
        threshold,
        filters.map((f) => ({ prop: f.prop, valueQid: f.valueQid })),
      );
      setFacets(r.ok ? (r.facets ?? []) : []);
    });

  const facetSelected = (prop: string, qid: string) =>
    filters.some((f) => f.prop === prop && f.valueQid === qid);

  const toggleFacet = (facet: Facet, v: { qid: string; label: string }) =>
    setFilters((fs) =>
      facetSelected(facet.prop, v.qid)
        ? fs.filter((f) => !(f.prop === facet.prop && f.valueQid === v.qid))
        : [...fs, { prop: facet.prop, valueQid: v.qid, propLabel: facet.propLabel, valueLabel: v.label }],
    );
  const addClass = (c: ClassCandidate) => {
    setClassItems((xs) => (xs.some((x) => x.qid === c.qid) ? xs : [...xs, c]));
    if (isCreate && !nameEn.trim()) setNameEn(c.label); // auto-suggest the name
  };

  // detect "role, not a class of people" (e.g. picked "president" concept)
  useEffect(() => {
    setRoleHint(null);
    if (classItems.length !== 1) return;
    const c = classItems[0];
    if (c.qid === "Q5") return; // "human" itself is fine
    let cancelled = false;
    roleCheckAction(c.qid).then((r) => {
      if (cancelled || !r.ok) return;
      if (Math.max(r.occupation ?? 0, r.position ?? 0) >= 20)
        setRoleHint({
          qid: c.qid,
          label: c.label,
          occupation: r.occupation ?? 0,
          position: r.position ?? 0,
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classItems]);

  const applyRole = () => {
    if (!roleHint) return;
    const prop = roleHint.occupation >= roleHint.position ? "P106" : "P39";
    const propLabel = prop === "P106" ? "рід занять" : "посада";
    setClassItems([{ qid: "Q5", label: "human" }]);
    setFilters([{ prop, valueQid: roleHint.qid, propLabel, valueLabel: roleHint.label }]);
    setFacets(null);
    setProbe(null);
    setPicked(new Set());
    setTotal(null);
    if (isCreate && !nameEn.trim()) setNameEn(roleHint.label);
    setRoleHint(null);
  };

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
        // default: name (always pulled) + the ONE primary image; rest is opt-in.
        // Noisy map/locator images aren't proposed at all.
        setPicked(new Set(defaultPickedProps(r.fields)));
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
      if (isCreate) {
        const r = await createDatasetAction({
          titleEn: nameEn,
          titleUk: nameUk,
          icon,
          categoryId: catId,
          classQids,
          sitelinksMin: threshold,
          fields,
          locales: [...locales],
          filters: filterPayload,
          difficultyBy: difficultyBy || undefined,
        });
        setResult(r);
        if (r.ok && r.slug) router.push(`/admin/topics/${r.slug}`); // → chunked import
      } else {
        const r = await setupTopicAction(
          topicSlug!,
          classQids,
          threshold,
          fields,
          ["en", ...locales],
          filterPayload,
          difficultyBy || undefined,
        );
        setResult(r);
        if (r.ok) setSaved(true); // switches to the batched import runner below
      }
    });

  // sorted by coverage (fullest first) so the useful fields are at the top
  const fields = probe?.ok
    ? (probe.fields ?? [])
        .filter((f) => !NOISY_IMAGE_PROPS.has(f.prop))
        .sort((a, b) => b.coverage - a.coverage)
    : null;
  // apply the coverage threshold, but never hide a field you've already ticked
  const visibleFields = (fields ?? []).filter(
    (f) => Math.round(f.coverage * 100) >= minCoverage || picked.has(f.prop),
  );
  const hiddenCount = (fields?.length ?? 0) - visibleFields.length;
  // date/number fields among the PICKED ones — candidates to rank difficulty by
  const diffOptions = fieldsFrom(
    (probe?.fields ?? []).filter((f) => picked.has(f.prop) && f.kind),
  ).filter((f) => f.kind === "date" || f.kind === "number");

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

      {roleHint && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-accent/40 bg-accent-soft/40 p-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-fg">
            <Lightbulb size={13} className="text-accent" /> «{roleHint.label}» — це радше роль, а не
            клас людей
          </p>
          <p className="text-muted">
            Людей із цією роллю: рід занять {roleHint.occupation}, посада {roleHint.position}. Краще
            взяти клас «людина» і звузити цією роллю.
          </p>
          <Button size="sm" variant="secondary" className="self-start" onClick={applyRole}>
            Взяти людей з роллю «{roleHint.label}»
          </Button>
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

      {/* facets: suggested ways to narrow, with counts (click to add a filter) */}
      {classItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            disabled={loadingFacets}
            onClick={loadFacets}
          >
            {loadingFacets ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Варіанти звуження
          </Button>
          {facets && facets.length === 0 && (
            <p className="text-[11px] text-muted">Немає підхожих фасетів для цього класу.</p>
          )}
          {facets && facets.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-line/60 p-2">
              {facets.map((f) => (
                <div key={f.prop} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-fg">{f.propLabel}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {f.values.map((v) => {
                      const sel = facetSelected(f.prop, v.qid);
                      return (
                        <button
                          key={v.qid}
                          type="button"
                          onClick={() => toggleFacet(f, v)}
                          className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                            sel ? "bg-accent text-white" : "bg-accent-soft text-accent hover:bg-accent-soft/70"
                          }`}
                        >
                          {v.label} · {v.count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted">
                Клікни варіант — додасться у фільтри. Потім натисни «Розвідка».
              </p>
            </div>
          )}
        </div>
      )}

      {/* optional narrowing filters (e.g. citizenship = Ukraine) */}
      <FilterBuilder filters={filters} onChange={setFilters} />

      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={photoOnly} onChange={(e) => setPhotoOnly(e.target.checked)} />
        Лише айтеми з фото (для візуальних ігор)
      </label>

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
              айтемів є поле. Відсортовано за заповненням.
              {probe?.sampleLabels?.length
                ? ` Приклади з: ${probe.sampleLabels.join(", ")}.`
                : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>Показувати поля із заповненням ≥</span>
              <select
                value={minCoverage}
                onChange={(e) => setMinCoverage(Number(e.target.value))}
                className="h-7 rounded-lg border border-line/60 bg-transparent px-1.5 text-fg outline-none focus:border-accent"
              >
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setMinCoverage(0)}
                  className="text-accent underline underline-offset-2"
                >
                  показати всі (+{hiddenCount})
                </button>
              )}
            </div>
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
                  {visibleFields.map((p) => (
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

          {/* difficulty ranking */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg">Складність рівнів за</span>
            <select
              value={difficultyBy}
              onChange={(e) => setDifficultyBy(e.target.value)}
              className="h-9 w-full max-w-xs rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
            >
              <option value="">популярністю (відомі — перші)</option>
              {diffOptions.map((f) => (
                <option key={f.role} value={f.role}>
                  {f.kind === "date" ? "датою" : "числом"}: {f.role} (новіше/більше — легше)
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted">
              За датою: сучасні — легкі рівні, давніші — складніші. Напр. правителі за
              роком народження.
            </span>
          </div>

          {/* CREATE mode: name + icon + category, then create in one step */}
          {isCreate && (
            <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
              <span className="text-xs font-semibold text-fg">Назва датасету</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Назва (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                <Input placeholder="Назва (UK)" value={nameUk} onChange={(e) => setNameUk(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="h-10 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
                >
                  {ICON_NAMES.map((i) => (
                    <option key={i} value={i}>
                      іконка: {i}
                    </option>
                  ))}
                </select>
                {categoryOptions && categoryOptions.length > 0 && (
                  <select
                    value={catId}
                    onChange={(e) => setCatId(e.target.value)}
                    className="h-10 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
                  >
                    <option value="">без категорії</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {saved ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-success">Конфіг збережено — тягну дані батчами:</span>
              {topicSlug && <ImportRunner topicSlug={topicSlug} autoStart />}
              <p className="text-[11px] text-muted">
                Іде по черзі, батч за батчем — не закривай сторінку до завершення.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                disabled={pending || picked.size === 0 || (isCreate && !nameEn.trim())}
                onClick={submit}
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {isCreate ? "Створити датасет" : "Зберегти й імпортувати"}
              </Button>
              {result && !result.ok && <span className="text-xs text-danger">{result.message}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
