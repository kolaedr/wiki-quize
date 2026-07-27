import { commonsThumb, qidFromUri, sparqlQuery } from "@/lib/wikidata/sparql";
import { filterClauses, type TopicFieldDef } from "./def";

export type Filter = { prop: string; valueQid: string };

const SEARCH_UA =
  process.env.WIKIMEDIA_UA ??
  "WikiQuize/0.1 (https://wikiquize.example; dev) class-search";

export interface ClassCandidate {
  qid: string;
  label: string;
  description?: string;
}

/**
 * Class search by WORD (no need to know QIDs): wbsearchentities returns
 * matching Wikidata items with label + description, the admin picks the right
 * concept ("automobile model" Q3231690 vs "automobile" Q1420). Ukrainian input
 * searches uk labels, Latin input searches en.
 */
export async function searchClasses(query: string): Promise<ClassCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const lang = /[Ѐ-ӿ]/.test(q) ? "uk" : "en";
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: q,
    language: lang,
    uselang: lang,
    type: "item",
    limit: "10",
    format: "json",
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": SEARCH_UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`wbsearchentities ${res.status}`);
  const json = (await res.json()) as {
    search?: { id: string; label?: string; description?: string }[];
  };
  return (json.search ?? [])
    .filter((s) => /^Q\d+$/.test(s.id))
    .map((s) => ({ qid: s.id, label: s.label ?? s.id, description: s.description }));
}

/**
 * Resolve labels for ids we already have (Q… and P… mixed) — used when an
 * EXISTING dataset config is reopened for editing: the DB stores bare QIDs, but
 * the form must show "human (Q5)" rather than a naked id.
 */
export async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  const clean = [...new Set(ids.filter((i) => /^[QP]\d+$/.test(i)))].slice(0, 50);
  if (clean.length === 0) return {};
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: clean.join("|"),
    props: "labels",
    languages: "en|uk",
    format: "json",
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": SEARCH_UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`wbgetentities ${res.status}`);
  const json = (await res.json()) as {
    entities?: Record<string, { labels?: Record<string, { value?: string }> }>;
  };
  const out: Record<string, string> = {};
  for (const [id, e] of Object.entries(json.entities ?? {}))
    out[id] = e.labels?.uk?.value ?? e.labels?.en?.value ?? id;
  return out;
}

export interface PropertyCandidate {
  /** e.g. "P27" */
  pid: string;
  label: string;
  description?: string;
}

/**
 * Property search by WORD for the optional narrowing filters: "citizenship" →
 * P27, "occupation" → P106. wbsearchentities with type=property. The admin then
 * searches the VALUE with searchClasses ("Ukraine" → Q212).
 */
export async function searchProperties(query: string): Promise<PropertyCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const lang = /[Ѐ-ӿ]/.test(q) ? "uk" : "en";
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "wbsearchentities",
    search: q,
    language: lang,
    uselang: lang,
    type: "property",
    limit: "10",
    format: "json",
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": SEARCH_UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`wbsearchentities ${res.status}`);
  const json = (await res.json()) as {
    search?: { id: string; label?: string; description?: string }[];
  };
  return (json.search ?? [])
    .filter((s) => /^P\d+$/.test(s.id))
    .map((s) => ({ pid: s.id, label: s.label ?? s.id, description: s.description }));
}

/**
 * PROBE (розвідка) — pipeline v2, step 1. Cheap reconnaissance queries the
 * admin runs BEFORE a full import: how many items exist, which properties
 * are actually filled in, what a top entity looks like. The admin then picks
 * fields with checkboxes instead of typing P-ids from memory.
 * See docs/plan/04-content-pipeline.md.
 */

const QID_RE = /^Q\d+$/;

function classUnion(classQids: string[], taxon = false, deep = false): string {
  const qids = classQids.filter((q) => QID_RE.test(q));
  if (qids.length === 0) throw new Error("classQids must be like Q3231690");
  // TAXON MODE: animals/plants are all P31 = taxon (Q16521); they relate by
  // PARENT TAXON (P171), not P31/P279. So match `?item wdt:P171* wd:<clade>` —
  // e.g. everything under Mammalia. That bounds a huge domain to one branch.
  if (taxon) return qids.map((q) => `{ ?item wdt:P171* wd:${q} . }`).join("\n  UNION\n  ");
  // Default PROBE uses DIRECT P31 (fast, an estimate). `deep` adds the P279*
  // subclass closure — a fallback for "umbrella" classes (e.g. road-sign
  // groupings) whose items are instances of SUBCLASSES, so direct P31 = 0.
  const path = deep ? "wdt:P31/wdt:P279*" : "wdt:P31";
  return qids.map((q) => `{ ?item ${path} wd:${q} . }`).join("\n  UNION\n  ");
}

/**
 * Sitelinks distribution for a class: [{sitelinks, n}] — ONE query, and any
 * threshold count is then computed client-side (live feedback while the admin
 * drags the threshold, no extra round-trips).
 */
export async function sitelinksDistribution(
  classQids: string[],
): Promise<{ sitelinks: number; n: number }[]> {
  // FILTER >= 10: items with almost no sitelinks are noise for these games and
  // scanning them is what makes this query time out on huge classes.
  const q = `
SELECT ?sitelinks (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ${classUnion(classQids)}
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 10)
}
GROUP BY ?sitelinks
ORDER BY DESC(?sitelinks)`;
  const rows = await sparqlQuery(q);
  return rows
    .map((r) => ({ sitelinks: Number(r.sitelinks?.value), n: Number(r.n?.value) }))
    .filter((r) => Number.isFinite(r.sitelinks) && Number.isFinite(r.n));
}

/** Count of items at a threshold, from a distribution (client-side math). */
export function countAtThreshold(
  dist: { sitelinks: number; n: number }[],
  threshold: number,
): number {
  return dist.reduce((sum, d) => (d.sitelinks >= threshold ? sum + d.n : sum), 0);
}

/**
 * Is this QID actually a ROLE people hold (occupation/position) rather than a
 * class of people? Counts humans (Q5) whose occupation (P106) or position held
 * (P39) is this entity. If large, the admin picked "president" the concept when
 * they wanted "humans who are presidents" → we can nudge them.
 */
export async function humansWithRole(qid: string): Promise<{ occupation: number; position: number }> {
  if (!QID_RE.test(qid)) return { occupation: 0, position: 0 };
  const one = async (prop: string) => {
    const rows = await sparqlQuery(`
SELECT (COUNT(DISTINCT ?o) AS ?n) WHERE {
  ?o wdt:P31 wd:Q5 ; wdt:${prop} wd:${qid} ; wikibase:sitelinks ?sl .
  FILTER(?sl >= 1)
}`);
    return Number(rows[0]?.n?.value ?? 0);
  };
  const [occupation, position] = await Promise.all([one("P106"), one("P39")]);
  return { occupation, position };
}

/** How many items of the class exist at a sitelinks threshold — ONE count. */
export async function countForClass(
  classQids: string[],
  sitelinksMin: number,
  filters?: Filter[],
  taxon = false,
): Promise<number> {
  const run = async (deep: boolean) => {
    const rows = await sparqlQuery(`
SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ${classUnion(classQids, taxon, deep)}
  ${filterClauses(filters)}
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= ${Math.max(0, Math.floor(sitelinksMin))})
}`);
    return Number(rows[0]?.n?.value ?? 0);
  };
  const direct = await run(false);
  // umbrella class with no direct instances → retry including subclasses (P279*),
  // so the count matches what the import will actually pull.
  if (direct === 0 && !taxon) return run(true);
  return direct;
}

export interface FacetValue {
  qid: string;
  label: string;
  count: number;
}
export interface Facet {
  prop: string;
  propLabel: string;
  values: FacetValue[];
}

/** Curated "narrowing" properties to offer as facets after a probe. */
const FACET_PROPS: { prop: string; label: string }[] = [
  { prop: "P106", label: "рід занять" },
  { prop: "P39", label: "посада" },
  { prop: "P27", label: "громадянство" },
  { prop: "P17", label: "країна" },
  { prop: "P136", label: "жанр" },
  { prop: "P641", label: "спорт" },
  { prop: "P105", label: "ранг таксона" }, // taxon mode: species/genus/family…
];

async function facetOne(
  classQids: string[],
  fp: { prop: string; label: string },
  sitelinksMin: number,
  filters?: Filter[],
  taxon = false,
): Promise<Facet | null> {
  const rows = await sparqlQuery(`
SELECT ?v ?vLabel (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ${classUnion(classQids, taxon)}
  ${filterClauses(filters)}
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= ${Math.max(0, Math.floor(sitelinksMin))})
  ?item wdt:${fp.prop} ?v .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?v ?vLabel
ORDER BY DESC(?n)
LIMIT 12`);
  const values = rows
    .map((r) => ({
      qid: qidFromUri(r.v?.value ?? ""),
      label: r.vLabel?.value ?? "",
      count: Number(r.n?.value ?? 0),
    }))
    .filter((x) => QID_RE.test(x.qid) && x.count > 0);
  return values.length ? { prop: fp.prop, propLabel: fp.label, values } : null;
}

/**
 * FACETS: after a probe, suggest HOW to narrow the class — the top values of
 * common narrowing properties (occupation, citizenship, position…) WITH counts,
 * so the admin clicks real options instead of guessing QIDs. Each facet prop is
 * a separate light query; empty ones are dropped.
 */
export async function discoverFacets(
  classQids: string[],
  sitelinksMin: number,
  filters?: Filter[],
  taxon = false,
): Promise<Facet[]> {
  const settled = await Promise.allSettled(
    FACET_PROPS.map((fp) => facetOne(classQids, fp, sitelinksMin, filters, taxon)),
  );
  return settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((f): f is Facet => !!f);
}

export interface ProbeProperty {
  /** e.g. "P18" */
  prop: string;
  /** English property label, e.g. "image" */
  label: string;
  /** mapped field kind; null = type we don't support yet (string/url/...) */
  kind: TopicFieldDef["kind"] | null;
  /** 0..1 — share of the sampled top entities that have this property */
  coverage: number;
}

export interface ProbeField {
  prop: string;
  label: string;
  kind: TopicFieldDef["kind"] | null;
  /** share of sampled items that carry this field (0..1) */
  coverage: number;
  /** one example value (for number/date) */
  example?: string;
  /** for image fields: a thumbnail URL to render inline */
  exampleImage?: string;
}

const TYPE_TO_KIND: Record<string, TopicFieldDef["kind"]> = {
  "http://wikiba.se/ontology#CommonsMedia": "image",
  "http://wikiba.se/ontology#Quantity": "number",
  "http://wikiba.se/ontology#Time": "date",
  "http://wikiba.se/ontology#WikibaseItem": "entityRefList",
  // short strings (element symbol P246, mottos, codes) → a text answer for quizzes
  "http://wikiba.se/ontology#String": "text",
  "http://wikiba.se/ontology#Monolingualtext": "text",
};

/**
 * Which properties are ACTUALLY filled in on the top-N entities of the class:
 * property, its label, its datatype (mapped to our field kinds) and coverage %.
 */
export async function discoverProperties(
  classQids: string[],
  sample = 50,
): Promise<{ sampleSize: number; properties: ProbeProperty[] }> {
  const n = Math.min(Math.max(sample, 10), 100);
  // FILTER >= 15 bounds the inner set BEFORE the sort — sorting every instance
  // of the class by sitelinks is the expensive part that 504s on big classes.
  const q = `
SELECT ?prop ?propLabel ?ptype (COUNT(DISTINCT ?item) AS ?cnt) WHERE {
  {
    SELECT DISTINCT ?item ?sl WHERE {
      ${classUnion(classQids)}
      ?item wikibase:sitelinks ?sl .
      FILTER(?sl >= 15)
    }
    ORDER BY DESC(?sl)
    LIMIT ${n}
  }
  ?item ?p ?value .
  ?prop wikibase:directClaim ?p ;
        wikibase:propertyType ?ptype .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?prop ?propLabel ?ptype
ORDER BY DESC(?cnt)
LIMIT 120`;
  const rows = await sparqlQuery(q);
  const properties: ProbeProperty[] = [];
  for (const r of rows) {
    const prop = qidFromUri(r.prop?.value ?? "");
    if (!/^P\d+$/.test(prop)) continue;
    properties.push({
      prop,
      label: r.propLabel?.value ?? prop,
      kind: TYPE_TO_KIND[r.ptype?.value ?? ""] ?? null,
      coverage: Math.min(1, Number(r.cnt?.value ?? 0) / n),
    });
  }
  return { sampleSize: n, properties };
}

export interface DiscoveredFields {
  sampleSize: number;
  /** labels of the sampled entities the examples came from */
  sampleLabels: string[];
  fields: ProbeField[];
}

/**
 * One entity's filled properties. GROUP BY property → ONE row per property with
 * a sample value, so nothing is truncated (a plain LIMIT over raw value rows
 * dropped fields at random — e.g. the flag on a rich entity). One entity, light.
 */
async function entityProps(qid: string): Promise<ProbeField[]> {
  // NB: the label service names its output ?<var>Label — the property var MUST
  // be ?prop so ?propLabel binds (a ?p would give ?pLabel → blank).
  const rows = await sparqlQuery(`
SELECT ?prop ?propLabel ?ptype (SAMPLE(STR(?v)) AS ?ex) WHERE {
  wd:${qid} ?pd ?v .
  ?prop wikibase:directClaim ?pd ; wikibase:propertyType ?ptype .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?prop ?propLabel ?ptype
LIMIT 500`);
  const out: ProbeField[] = [];
  for (const r of rows) {
    const prop = qidFromUri(r.prop?.value ?? "");
    if (!/^P\d+$/.test(prop)) continue;
    const kind = TYPE_TO_KIND[r.ptype?.value ?? ""] ?? null;
    const ex = r.ex?.value;
    out.push({
      prop,
      label: r.propLabel?.value ?? prop,
      kind,
      coverage: 0,
      example: kind === "number" || kind === "date" || kind === "text" ? ex : undefined,
      exampleImage: kind === "image" && ex ? commonsThumb(ex, 96) : undefined,
    });
  }
  return out;
}

/**
 * Probe fields: union the filled properties of the TOP few items (separate
 * light queries — no heavy aggregation), so a field most items have but the #1
 * lacks still shows up. Generic — no per-class special-casing. Image fields
 * carry a thumbnail; `coverage` = share of sampled items that had the field.
 */
export async function discoverFields(
  classQids: string[],
  filters?: Filter[],
  taxon = false,
): Promise<DiscoveredFields> {
  const N = 3;
  // Sample the top entities WITHIN the filtered set, so previews/fields reflect
  // what the import will actually pull (e.g. Ukrainian humans, not all humans).
  const fetchTop = (deep: boolean) =>
    sparqlQuery(`
SELECT ?item ?itemLabel WHERE {
  { SELECT ?item ?sl WHERE { ${classUnion(classQids, taxon, deep)} ${filterClauses(filters)} ?item wikibase:sitelinks ?sl . } ORDER BY DESC(?sl) LIMIT ${N} }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
  // direct P31 first; if the class has only subclass instances, retry deep so
  // fields still show up (the import uses P279* anyway).
  let top = await fetchTop(false);
  if (top.length === 0 && !taxon) top = await fetchTop(true);
  const picks = top
    .map((r) => ({ qid: qidFromUri(r.item?.value ?? ""), label: r.itemLabel?.value }))
    .filter((p) => QID_RE.test(p.qid));
  const qids = picks.map((p) => p.qid);
  const sampleLabels = picks.map((p) => p.label ?? p.qid);
  if (qids.length === 0) return { sampleSize: 0, sampleLabels: [], fields: [] };

  const perEntity = await Promise.all(qids.map((q) => entityProps(q)));
  const agg = new Map<string, ProbeField & { count: number }>();
  for (const props of perEntity) {
    for (const p of props) {
      const cur = agg.get(p.prop);
      if (cur) {
        cur.count += 1;
        cur.example ??= p.example;
        cur.exampleImage ??= p.exampleImage;
      } else {
        agg.set(p.prop, { ...p, count: 1 });
      }
    }
  }
  const rank = (k: TopicFieldDef["kind"] | null) =>
    k === "image" ? 0 : k === "date" ? 1 : k === "number" ? 2 : k === "entityRefList" ? 3 : 9;
  const fields = [...agg.values()]
    .map(({ count, ...f }) => ({ ...f, coverage: count / qids.length }))
    .sort((a, b) => rank(a.kind) - rank(b.kind) || b.coverage - a.coverage);
  return { sampleSize: qids.length, sampleLabels, fields };
}

export interface SampleEntity {
  qid: string;
  label: string;
  sitelinks: number;
  /** prop → up to 3 human-readable values */
  values: Record<string, string[]>;
}

/** One real top entity with its values — a live preview before the import. */
export async function sampleEntity(
  classQids: string[],
  props: string[],
): Promise<SampleEntity | null> {
  const top = await sparqlQuery(`
SELECT ?item ?itemLabel ?sl WHERE {
  {
    SELECT DISTINCT ?item ?sl WHERE {
      ${classUnion(classQids)}
      ?item wikibase:sitelinks ?sl .
    }
    ORDER BY DESC(?sl)
    LIMIT 1
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
  const qid = qidFromUri(top[0]?.item?.value ?? "");
  if (!QID_RE.test(qid)) return null;

  const safeProps = props.filter((p) => /^P\d+$/.test(p)).slice(0, 20);
  const values: Record<string, string[]> = {};
  if (safeProps.length > 0) {
    const rows = await sparqlQuery(`
SELECT ?p ?v ?vLabel WHERE {
  VALUES ?pd { ${safeProps.map((p) => `wdt:${p}`).join(" ")} }
  wd:${qid} ?pd ?v .
  ?p wikibase:directClaim ?pd .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 60`);
    for (const r of rows) {
      const p = qidFromUri(r.p?.value ?? "");
      const label = r.vLabel?.value ?? r.v?.value ?? "";
      if (!p || !label) continue;
      const arr = (values[p] ??= []);
      if (arr.length < 3) arr.push(label);
    }
  }

  return {
    qid,
    label: top[0]?.itemLabel?.value ?? qid,
    sitelinks: Number(top[0]?.sl?.value ?? 0),
    values,
  };
}
