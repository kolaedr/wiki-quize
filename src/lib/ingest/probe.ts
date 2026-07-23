import { commonsThumb, qidFromUri, sparqlQuery } from "@/lib/wikidata/sparql";
import type { TopicFieldDef } from "./def";

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
 * PROBE (розвідка) — pipeline v2, step 1. Cheap reconnaissance queries the
 * admin runs BEFORE a full import: how many items exist, which properties
 * are actually filled in, what a top entity looks like. The admin then picks
 * fields with checkboxes instead of typing P-ids from memory.
 * See docs/plan/04-content-pipeline.md.
 */

const QID_RE = /^Q\d+$/;

function classUnion(classQids: string[]): string {
  const qids = classQids.filter((q) => QID_RE.test(q));
  if (qids.length === 0) throw new Error("classQids must be like Q3231690");
  // PROBE uses DIRECT P31 (no P279* transitive closure). Reconnaissance must be
  // fast/reliable; the transitive closure is what times out on big classes like
  // "country" (Q6256). It's an ESTIMATE — the real import (buildTopicQuery) still
  // uses P31/P279* to also catch subclass instances.
  return qids.map((q) => `{ ?item wdt:P31 wd:${q} . }`).join("\n  UNION\n  ");
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

/** How many items of the class exist at a sitelinks threshold — ONE count. */
export async function countForClass(
  classQids: string[],
  sitelinksMin: number,
): Promise<number> {
  const rows = await sparqlQuery(`
SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ${classUnion(classQids)}
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl >= ${Math.max(0, Math.floor(sitelinksMin))})
}`);
  return Number(rows[0]?.n?.value ?? 0);
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
  /** one example value (label) from the sample entity */
  example?: string;
  /** for image fields: a thumbnail URL to render inline */
  exampleImage?: string;
}

export interface ProbeSample {
  qid: string;
  label: string;
  /** global wiki article count — a popularity proxy, NOT what we store */
  popularity: number;
  fields: ProbeField[];
}

const TYPE_TO_KIND: Record<string, TopicFieldDef["kind"]> = {
  "http://wikiba.se/ontology#CommonsMedia": "image",
  "http://wikiba.se/ontology#Quantity": "number",
  "http://wikiba.se/ontology#Time": "date",
  "http://wikiba.se/ontology#WikibaseItem": "entityRefList",
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

/**
 * THE probe: ONE representative (top) entity with its filled properties and
 * example values. Root language = English. Two light queries — instant, so the
 * request never hangs. The admin sees the fields, ticks what to pull, and only
 * THEN runs the heavy batch import.
 */
export async function sampleWithFields(classQids: string[]): Promise<ProbeSample | null> {
  const top = await sparqlQuery(`
SELECT ?item ?itemLabel ?sl WHERE {
  { SELECT ?item ?sl WHERE { ${classUnion(classQids)} ?item wikibase:sitelinks ?sl . } ORDER BY DESC(?sl) LIMIT 1 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
  const qid = qidFromUri(top[0]?.item?.value ?? "");
  if (!QID_RE.test(qid)) return null;

  // NB: the label service names the output ?<var>Label — so the property var
  // MUST be ?prop for ?propLabel to bind (a previous ?p gave ?pLabel → blank).
  const rows = await sparqlQuery(`
SELECT ?prop ?propLabel ?ptype ?v ?vLabel WHERE {
  wd:${qid} ?pd ?v .
  ?prop wikibase:directClaim ?pd ; wikibase:propertyType ?ptype .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 500`);
  const byProp = new Map<string, ProbeField>();
  for (const r of rows) {
    const prop = qidFromUri(r.prop?.value ?? "");
    if (!/^P\d+$/.test(prop) || byProp.has(prop)) continue;
    const kind = TYPE_TO_KIND[r.ptype?.value ?? ""] ?? null;
    byProp.set(prop, {
      prop,
      label: r.propLabel?.value ?? prop,
      kind,
      example: r.vLabel?.value,
      exampleImage: kind === "image" && r.v?.value ? commonsThumb(r.v.value, 96) : undefined,
    });
  }
  // order: images first, then dates, numbers, refs, unsupported last
  const rank = (k: TopicFieldDef["kind"] | null) =>
    k === "image" ? 0 : k === "date" ? 1 : k === "number" ? 2 : k === "entityRefList" ? 3 : 9;
  const fields = [...byProp.values()].sort((a, b) => rank(a.kind) - rank(b.kind));
  return {
    qid,
    label: top[0]?.itemLabel?.value ?? qid,
    popularity: Number(top[0]?.sl?.value ?? 0),
    fields,
  };
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
