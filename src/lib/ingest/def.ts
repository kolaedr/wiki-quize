import type { LocalizedText } from "@/db/schema";
import { commonsThumb, qidFromUri, type SparqlRow } from "@/lib/wikidata/sparql";
import type { RawEntity } from "./presets";

/**
 * NO-CODE topic builder: a topic is DATA (stored in topics.sourceConfig.def),
 * the SPARQL query is GENERATED from it, and games are auto-derived from the
 * field kinds. Adding "Landmarks" or "Historical events" = filling a form,
 * zero code.
 */

export interface TopicFieldDef {
  /** role name used in values/config, e.g. "photo", "country", "opened" */
  role: string;
  kind: "image" | "number" | "date" | "entityRefList";
  /** Wikidata property, e.g. "P18"; "P495|P17" = try either (UNION) */
  prop: string;
  /** entity must have this field to enter the pool */
  required?: boolean;
}

export interface TopicDef {
  slug: string;
  title: Record<string, string>;
  icon: string;
  /** instance-of classes (P31/P279*), ANY of — e.g. ["Q570116"] tourist attraction */
  classQids: string[];
  excludeClassQids?: string[];
  sitelinksMin: number;
  limit: number;
  fields: TopicFieldDef[];
  /**
   * Languages to pull. locales[0] is the ROOT (required — an item without it is
   * dropped); the rest are best-effort (stored if present, never a filter), and
   * more can be added later via a re-sync. Defaults to ["en"].
   */
  locales?: string[];
}

const QID_RE = /^Q\d+$/;
const PROP_RE = /^P\d+(\|P\d+)*$/;

/** Throws a readable error when the admin-entered definition is malformed. */
export function validateDef(def: TopicDef) {
  if (!/^[a-z0-9-]{2,40}$/.test(def.slug)) throw new Error("bad slug (a-z, 0-9, -)");
  if (!def.title?.en) throw new Error("title.en is required");
  if (!def.classQids?.length || def.classQids.some((q) => !QID_RE.test(q)))
    throw new Error("classQids must be like Q570116");
  if (def.excludeClassQids?.some((q) => !QID_RE.test(q)))
    throw new Error("excludeClassQids must be like Q123");
  if (!def.fields?.length) throw new Error("at least one field is required");
  for (const f of def.fields) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(f.role)) throw new Error(`bad role: ${f.role}`);
    if (!PROP_RE.test(f.prop)) throw new Error(`bad property: ${f.prop} (expected P123 or P1|P2)`);
  }
  if (!Number.isFinite(def.sitelinksMin) || def.sitelinksMin < 0)
    throw new Error("sitelinksMin must be >= 0");
}

/**
 * Generate the SPARQL query for a definition (labels + sitelinks + fields).
 * `range` restricts sitelinks to a half-open band [min, maxExclusive) so the
 * import can fetch big classes in BATCHES that each stay under the public
 * endpoint's ~60s timeout (see fetchDefRows in run.ts).
 */
export function buildTopicQuery(
  def: TopicDef,
  locales: readonly string[],
  range?: { min: number; maxExclusive?: number },
): string {
  const min = range?.min ?? def.sitelinksMin;
  const maxClause =
    range?.maxExclusive != null ? `FILTER(?sitelinks < ${range.maxExclusive})` : "";
  // locales[0] = ROOT (required); the rest are OPTIONAL (best-effort per-locale
  // fill), so adding a language never shrinks the dataset.
  const labelClauses = locales
    .map((l, i) => {
      const label = `?item rdfs:label ?label_${l} FILTER(LANG(?label_${l}) = "${l}") .`;
      const article = `OPTIONAL { ?article_${l} schema:about ?item ; schema:isPartOf <https://${l}.wikipedia.org/> . }`;
      return i === 0 ? `${label}\n  ${article}` : `OPTIONAL { ${label} }\n  ${article}`;
    })
    .join("\n  ");
  const labelVars = locales.map((l) => `?label_${l} ?article_${l}`).join(" ");

  const classUnion = def.classQids
    .map((q) => `{ ?item wdt:P31/wdt:P279* wd:${q} . }`)
    .join("\n  UNION\n  ");
  const excludes = (def.excludeClassQids ?? [])
    .map((q) => `MINUS { ?item wdt:P31 wd:${q} . }`)
    .join("\n  ");

  const propPath = (prop: string) => prop.split("|").map((p) => `wdt:${p}`).join("|");

  const fieldClauses = def.fields
    .map((f) =>
      f.kind === "entityRefList"
        ? `OPTIONAL { ?item ${propPath(f.prop)} ?ref_${f.role} . }`
        : `OPTIONAL { ?item ${propPath(f.prop)} ?v_${f.role} . }`,
    )
    .join("\n  ");

  const scalarVars = def.fields
    .filter((f) => f.kind !== "entityRefList")
    .map((f) => `?v_${f.role}`);
  const refVars = def.fields
    .filter((f) => f.kind === "entityRefList")
    .map(
      (f) =>
        `(GROUP_CONCAT(DISTINCT STRAFTER(STR(?ref_${f.role}), "entity/"); separator="|") AS ?refs_${f.role})`,
    );

  const groupBy = ["?item", "?sitelinks", labelVars, ...scalarVars].join(" ");

  return `
SELECT ?item ?sitelinks ${labelVars} ${scalarVars.join(" ")} ${refVars.join(" ")}
WHERE {
  ${classUnion}
  ${excludes}
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${min})
  ${maxClause}
  ${labelClauses}
  ${fieldClauses}
}
GROUP BY ${groupBy}
LIMIT ${Math.min(def.limit || 500, 5000)}
`;
}

/** Normalize one SPARQL row according to the definition. */
export function normalizeDefRow(
  def: TopicDef,
  row: SparqlRow,
  locales: readonly string[],
): RawEntity | null {
  const qid = qidFromUri(row.item?.value ?? "");
  if (!qid) return null;

  const labels: LocalizedText = {};
  const wikiLinks: LocalizedText = {};
  for (const l of locales) {
    const label = row[`label_${l}`]?.value;
    if (label) labels[l] = label;
    const article = row[`article_${l}`]?.value;
    if (article) wikiLinks[l] = article;
  }

  const values: Record<string, unknown> = {};
  let imageUrl: string | undefined;
  for (const f of def.fields) {
    if (f.kind === "entityRefList") {
      const raw = row[`refs_${f.role}`]?.value;
      values[f.role] = raw ? raw.split("|").filter(Boolean) : [];
    } else {
      const raw = row[`v_${f.role}`]?.value;
      if (raw == null) continue;
      if (f.kind === "image") {
        values[f.role] = commonsThumb(raw);
        imageUrl ??= values[f.role] as string;
      } else if (f.kind === "number") {
        const n = Number(raw);
        if (Number.isFinite(n)) values[f.role] = n;
      } else {
        // date → store the YEAR as a number (comparable by the mechanics)
        const year = Number.parseInt(raw.slice(0, raw.startsWith("-") ? 5 : 4), 10);
        if (Number.isFinite(year)) values[f.role] = year;
      }
    }
  }

  return {
    qid,
    labels,
    wikiLinks,
    sitelinks: Number(row.sitelinks?.value ?? 0),
    imageUrl,
    values,
  };
}

/** Field kinds → auto-generated games (published if enough items). */
export interface AutoGame {
  slug: string;
  title: Record<string, string>;
  icon: string;
  mechanic: "choice" | "higher_lower" | "swipe_binary";
  config: Record<string, unknown>;
  countRole?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function autoGamesFor(def: TopicDef): AutoGame[] {
  const out: AutoGame[] = [];
  const t = (suffix: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(def.title).map(([l, v]) => [l, `${v}: ${suffix[l] ?? suffix.en}`]),
    );
  const images = def.fields.filter((f) => f.kind === "image");
  const firstImage = images[0]?.role;

  for (const f of images) {
    out.push({
      slug: `${def.slug}-${f.role}`,
      title: t({ en: cap(f.role), uk: cap(f.role) }),
      icon: def.icon,
      mechanic: "choice",
      config: { answerRole: f.role, singleTmpl: "isThis" },
      countRole: f.role,
    });
  }
  for (const f of def.fields.filter((x) => x.kind === "entityRefList")) {
    out.push({
      slug: `${def.slug}-${f.role}`,
      title: t({ en: cap(f.role), uk: cap(f.role) }),
      icon: def.icon,
      mechanic: "choice",
      config: { refRole: f.role, promptImageRole: firstImage },
      countRole: f.role,
    });
    // reverse direction: prompt = the parent ("Audi"), options = entities (models)
    out.push({
      slug: `${def.slug}-${f.role}-rev`,
      title: t({ en: `Guess by ${f.role}`, uk: `Вгадай за: ${f.role}` }),
      icon: def.icon,
      mechanic: "choice",
      config: { refRole: f.role, refDirection: "parent" },
      countRole: f.role,
    });
  }
  for (const f of def.fields.filter((x) => x.kind === "number")) {
    out.push({
      slug: `${def.slug}-${f.role}`,
      title: t({ en: `Higher: ${f.role}`, uk: `Більше: ${f.role}` }),
      icon: def.icon,
      mechanic: "higher_lower",
      config: { valueRole: f.role, tmpl: "moreValue", imageRole: firstImage },
      countRole: f.role,
    });
  }
  const dates = def.fields.filter((x) => x.kind === "date");
  if (dates.length > 0) {
    out.push({
      slug: `${def.slug}-timeline-tf`,
      title: t({ en: "True or false: dates", uk: "Правда чи ні: дати" }),
      icon: def.icon,
      mechanic: "swipe_binary",
      config: { roles: dates.map((d) => ({ role: d.role, tmpl: "newerThan" })) },
      countRole: dates[0].role,
    });
  }
  return out;
}

/** Ready-made definitions the admin can one-click add (the user's examples). */
export const DEF_TEMPLATES: TopicDef[] = [
  {
    slug: "car-models",
    title: { en: "Car models", uk: "Моделі авто" },
    icon: "car",
    classQids: ["Q3231690"], // automobile model
    sitelinksMin: 18,
    limit: 600,
    fields: [
      { role: "photo", kind: "image", prop: "P18" },
      { role: "brand", kind: "entityRefList", prop: "P176", required: true },
      { role: "year", kind: "date", prop: "P571" },
    ],
  },
  {
    slug: "landmarks",
    title: { en: "Landmarks", uk: "Визначні місця" },
    icon: "landmark",
    classQids: ["Q570116", "Q839954"], // tourist attraction, archaeological site
    sitelinksMin: 60,
    limit: 400,
    fields: [
      { role: "photo", kind: "image", prop: "P18", required: true },
      { role: "country", kind: "entityRefList", prop: "P17" },
      { role: "opened", kind: "date", prop: "P571" },
    ],
  },
  {
    slug: "historical-events",
    title: { en: "Historical events", uk: "Історичні події" },
    icon: "scale",
    classQids: ["Q13418847", "Q178561"], // historical event, battle
    sitelinksMin: 45,
    limit: 400,
    fields: [
      { role: "photo", kind: "image", prop: "P18" },
      { role: "date", kind: "date", prop: "P585", required: true },
      { role: "country", kind: "entityRefList", prop: "P17" },
    ],
  },
];
