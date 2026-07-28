"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countClassAction,
  createDatasetAction,
  probeClassAction,
  probeFacetsAction,
  resolveLabelsAction,
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

/** Saved config of an already-configured dataset, reopened for editing. */
export interface DatasetInitialConfig {
  classQids: string[];
  sitelinksMin: number;
  fields: TopicFieldDef[];
  /** extra locales beyond the "en" root */
  locales: string[];
  filters: { prop: string; valueQid: string }[];
  difficultyBy?: string;
  taxonMode?: boolean;
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
  label = (_id: string, fallback: string) => fallback,
}: {
  filters: ActiveFilter[];
  onChange: (f: ActiveFilter[]) => void;
  /** resolves a QID/PID to a human label once the lookup lands */
  label?: (id: string, fallback: string) => string;
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
              {label(f.prop, f.propLabel)} = {label(f.valueQid, f.valueLabel)}
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
  initial,
}: {
  /** present = configure an existing draft; absent = CREATE a new dataset */
  topicSlug?: string;
  categoryId?: string;
  categoryOptions?: DatasetCategoryOption[];
  /** present = EDIT an already-configured dataset (form starts pre-filled) */
  initial?: DatasetInitialConfig;
}) {
  const isCreate = !topicSlug;
  const isEdit = !!initial;
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameUk, setNameUk] = useState("");
  const [icon, setIcon] = useState("deck");
  const [catId, setCatId] = useState(categoryId ?? "");
  const [classItems, setClassItems] = useState<ClassCandidate[]>(
    () => initial?.classQids.map((qid) => ({ qid, label: qid })) ?? [],
  );
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ClassCandidate[] | null>(null);
  const [manual, setManual] = useState("");
  const [threshold, setThreshold] = useState(initial?.sitelinksMin ?? 30);
  const [minCoverage, setMinCoverage] = useState(70); // hide sparse fields by default
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial?.fields.map((f) => f.prop) ?? []),
  );
  // "лише з фото" is stored as a bare P18 presence filter — split it back out
  const [filters, setFilters] = useState<ActiveFilter[]>(
    () =>
      initial?.filters
        .filter((f) => f.valueQid)
        .map((f) => ({
          prop: f.prop,
          valueQid: f.valueQid,
          propLabel: f.prop,
          valueLabel: f.valueQid,
        })) ?? [],
  );
  const [photoOnly, setPhotoOnly] = useState(
    () => initial?.filters.some((f) => f.prop === "P18" && !f.valueQid) ?? false,
  );
  const [taxonMode, setTaxonMode] = useState(initial?.taxonMode ?? false); // animals/plants: P171*
  const [difficultyBy, setDifficultyBy] = useState(initial?.difficultyBy ?? ""); // "" = popularity
  const [facets, setFacets] = useState<Facet[] | null>(null);
  const [loadingFacets, startFacets] = useTransition();
  const [locales, setLocales] = useState<Set<string>>(
    () => new Set(initial ? initial.locales.filter((l) => l !== "en") : ["uk"]),
  );
  const [searching, startSearch] = useTransition();
  const [probing, startProbe] = useTransition();
  const [counting, startCount] = useTransition();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saved, setSaved] = useState(false); // config saved → run batched import

  // labels land from the query; decorate at render instead of writing them back
  // into state, which is what forced the old cancelled-flag effect
  const label = (id: string, fallback: string) => labelMap?.[id] ?? fallback;
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
        taxonMode,
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

  /**
   * EDIT mode: the DB only stores ids, so fetch human labels for the chips —
   * "human (Q5)" instead of a bare QID. A query, not an effect: the cancelled
   * flag, the manual state copy and the "fire once" dance all come free, and
   * reopening the form hits the cache.
   */
  const labelIds = initial
    ? [
        ...initial.classQids,
        ...initial.filters.flatMap((f) => [f.prop, f.valueQid].filter(Boolean)),
      ]
    : [];
  const { data: labelMap } = useQuery({
    queryKey: ["admin", "labels", labelIds],
    queryFn: async () => (await resolveLabelsAction(labelIds)).labels ?? {},
    enabled: labelIds.length > 0,
    staleTime: Infinity, // Wikidata labels don't move
  });

  /**
   * "That's a ROLE, not a class of people" hint (picking the concept
   * "president" instead of humans who held it). Derived from a query keyed by
   * the chosen class, so it can't linger from a previous selection the way the
   * old effect-plus-setState version could.
   */
  const soleClass = classItems.length === 1 ? classItems[0] : null;
  const { data: roleCheck } = useQuery({
    queryKey: ["admin", "role-check", soleClass?.qid],
    queryFn: () => roleCheckAction(soleClass!.qid),
    enabled: !!soleClass && soleClass.qid !== "Q5", // "human" itself is fine
  });
  const roleHint =
    soleClass && roleCheck?.ok && Math.max(roleCheck.occupation ?? 0, roleCheck.position ?? 0) >= 20
      ? {
          qid: soleClass.qid,
          label: soleClass.label,
          occupation: roleCheck.occupation ?? 0,
          position: roleCheck.position ?? 0,
        }
      : null;

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
    // no reset needed: the hint is derived from classItems, and we just
    // replaced them with Q5 — it disappears on its own
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
      const r = await probeClassAction(classCsv, threshold, filterPayload, taxonMode);
      setProbe(r);
      setTotal(r.total ?? null);
      if (r.ok && r.fields) {
        // default: name (always pulled) + the ONE primary image; rest is opt-in.
        // Noisy map/locator images aren't proposed at all.
        // EDIT mode: never clobber what's already configured — re-probing is how
        // you ADD fields to an existing dataset, so the saved picks stay ticked.
        const fresh = new Set(defaultPickedProps(r.fields));
        setPicked((prev) => (prev.size > 0 ? prev : fresh));
      }
    });

  const recount = () =>
    startCount(async () => {
      const r = await countClassAction(classCsv, threshold, filterPayload, taxonMode);
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
      // No probe run in EDIT mode = the admin only touched threshold/locales/
      // filters, so the saved field defs are reused verbatim (re-probing just to
      // change a number would be wasteful and could silently drop a field).
      const fields = probe?.ok
        ? fieldsFrom((probe.fields ?? []).filter((f) => picked.has(f.prop) && f.kind))
        : (initial?.fields ?? []);
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
          taxonMode,
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
          taxonMode,
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
  // date/number fields among the PICKED ones — candidates to rank difficulty by.
  // Without a probe (edit mode, untouched fields) fall back to the saved defs.
  const diffOptions = (
    probe?.ok
      ? fieldsFrom((probe.fields ?? []).filter((f) => picked.has(f.prop) && f.kind))
      : (initial?.fields ?? [])
  ).filter((f) => f.kind === "date" || f.kind === "number");
  // the settings panel (threshold, languages, difficulty, save) is available
  // immediately when editing — a probe is only needed to CHANGE the field list
  const showSettings = !!fields || isEdit;

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
              {label(c.qid, c.label)}
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
      <FilterBuilder filters={filters} onChange={setFilters} label={label} />

      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={photoOnly} onChange={(e) => setPhotoOnly(e.target.checked)} />
        Лише айтеми з фото (для візуальних ігор)
      </label>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={taxonMode}
          onChange={(e) => setTaxonMode(e.target.checked)}
        />
        <span>
          Таксон-режим (тварини/рослини): шукати за деревом{" "}
          <span className="font-semibold">parent taxon (P171)</span>, а не за класом. Клас
          обери як конкретну групу — напр. «Mammalia», «Aves», «Felidae». Так «усі ссавці»
          нарешті потягне, а не впреться в мільйони таксонів.
        </span>
      </label>

      <Button size="sm" className="self-start" disabled={probing || classItems.length === 0} onClick={runProbe}>
        {probing ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        {isEdit ? "Розвідка (щоб змінити поля)" : "Розвідка (англійська)"}
      </Button>

      {probe && !probe.ok && <p className="text-xs text-danger">{probe.message}</p>}
      {probe?.ok && probe.message && <p className="text-xs text-amber-500">{probe.message}</p>}

      {showSettings && (
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

          {/* EDIT without a probe: show what's already configured, read-only */}
          {!fields && initial && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-fg">
                Поля датасету ({initial.fields.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {initial.fields.map((f) => (
                  <span
                    key={f.role}
                    className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] text-accent"
                  >
                    {f.role} · {KIND_UK[f.kind] ?? f.kind}{" "}
                    <span className="opacity-70">{f.prop}</span>
                  </span>
                ))}
                {initial.fields.length === 0 && (
                  <span className="text-[11px] text-muted">полів немає</span>
                )}
              </div>
              <span className="text-[11px] text-muted">
                Щоб додати/прибрати поля — натисни «Розвідка» вище: таблиця полів
                зʼявиться з уже позначеними поточними.
              </span>
            </div>
          )}

          {/* fields = checkboxes discovered across the top items */}
          {fields && (
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
          )}

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
              <span className="text-xs text-success">
                {isEdit
                  ? "Конфіг оновлено. Щоб він застосувався до айтемів — прожени чергу:"
                  : "Конфіг збережено — тягну дані батчами:"}
              </span>
              {/* editing never auto-fires a re-import: the admin may be mid-way
                  through tweaking and a re-sync is a deliberate act */}
              {topicSlug && <ImportRunner topicSlug={topicSlug} autoStart={!isEdit} />}
              <p className="text-[11px] text-muted">
                Іде по черзі, батч за батчем — не закривай сторінку до завершення.
                {isEdit && " Ресинк доповнює наявні айтеми новими полями (не видаляє їх)."}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={
                  pending ||
                  (isCreate && !nameEn.trim()) ||
                  classItems.length === 0 ||
                  // editing may save with the OLD field set untouched; a fresh
                  // setup must have at least one field ticked
                  (probe ? picked.size === 0 : !isEdit)
                }
                onClick={submit}
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {isCreate
                  ? "Створити датасет"
                  : isEdit
                    ? "Зберегти конфіг"
                    : "Зберегти й імпортувати"}
              </Button>
              {isEdit && (
                <span className="text-[11px] text-muted">
                  Айтеми не видаляються — після збереження запусти ресинк.
                </span>
              )}
              {result && !result.ok && <span className="text-xs text-danger">{result.message}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
