import type { LocalizedText } from "@/db/schema";
import { ACTIVE_LOCALES } from "@/i18n/locales";
import { commonsThumb, qidFromUri, type SparqlRow } from "@/lib/wikidata/sparql";

/** Normalized entity produced by a preset before DB insert. */
export interface RawEntity {
  qid: string;
  labels: LocalizedText;
  values: Record<string, unknown>;
  imageUrl?: string;
  wikiLinks: LocalizedText;
  sitelinks: number;
}

export interface TopicPreset {
  key: string;
  slug: string;
  title: LocalizedText;
  fieldSchema: { role: string; kind: string; wikidataProp?: string }[];
  /** Fields an entity MUST have to enter the pool (besides labels in all active locales). */
  requiredRoles: string[];
  query: string;
  normalize(row: SparqlRow): RawEntity | null;
}

/** rdfs:label triples per active locale + wiki sitelink per locale. */
const labelClauses = ACTIVE_LOCALES.map(
  (l) =>
    `?item rdfs:label ?label_${l} FILTER(LANG(?label_${l}) = "${l}") .
     OPTIONAL { ?article_${l} schema:about ?item ; schema:isPartOf <https://${l}.wikipedia.org/> . }`,
).join("\n  ");

const labelVars = ACTIVE_LOCALES.map((l) => `?label_${l} ?article_${l}`).join(" ");

function pickLabels(row: SparqlRow): { labels: LocalizedText; wikiLinks: LocalizedText } {
  const labels: LocalizedText = {};
  const wikiLinks: LocalizedText = {};
  for (const l of ACTIVE_LOCALES) {
    const label = row[`label_${l}`]?.value;
    if (label) labels[l] = label;
    const article = row[`article_${l}`]?.value;
    if (article) wikiLinks[l] = article;
  }
  return { labels, wikiLinks };
}

const countries: TopicPreset = {
  key: "countries",
  slug: "countries",
  title: { en: "Countries", uk: "Країни" },
  fieldSchema: [
    { role: "flag", kind: "image", wikidataProp: "P41" },
    { role: "arms", kind: "image", wikidataProp: "P237" },
    { role: "languages", kind: "entityRefList", wikidataProp: "P37" },
    { role: "population", kind: "number", wikidataProp: "P1082" },
    { role: "area", kind: "number", wikidataProp: "P2046" },
    { role: "continents", kind: "entityRefList", wikidataProp: "P30" },
  ],
  requiredRoles: ["flag"],
  query: `
SELECT ?item ?sitelinks ?flag ?arms ?population ?area ${labelVars}
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?lang), "entity/"); separator="|") AS ?langs)
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?cont), "entity/"); separator="|") AS ?conts)
WHERE {
  ?item wdt:P31 wd:Q6256 .
  MINUS { ?item wdt:P31 wd:Q3024240 }   # exclude historical countries
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 60)
  ${labelClauses}
  OPTIONAL { ?item wdt:P41 ?flag . }
  OPTIONAL { ?item wdt:P237 ?arms . }
  OPTIONAL { ?item wdt:P1082 ?population . }
  OPTIONAL { ?item wdt:P2046 ?area . }
  OPTIONAL { ?item wdt:P37 ?lang . }
  OPTIONAL { ?item wdt:P30 ?cont . }
}
GROUP BY ?item ?sitelinks ?flag ?arms ?population ?area ${labelVars}
`,
  normalize(row) {
    const qid = qidFromUri(row.item?.value ?? "");
    if (!qid) return null;
    const { labels, wikiLinks } = pickLabels(row);
    const flag = row.flag?.value ? commonsThumb(row.flag.value) : undefined;
    return {
      qid,
      labels,
      wikiLinks,
      sitelinks: Number(row.sitelinks?.value ?? 0),
      imageUrl: flag,
      values: {
        flag,
        arms: row.arms?.value ? commonsThumb(row.arms.value) : undefined,
        population: row.population ? Number(row.population.value) : undefined,
        area: row.area ? Number(row.area.value) : undefined,
        languages: row.langs?.value ? row.langs.value.split("|").filter(Boolean) : [],
        continents: row.conts?.value ? row.conts.value.split("|").filter(Boolean) : [],
      },
    };
  },
};

const carBrands: TopicPreset = {
  key: "car-brands",
  slug: "car-brands",
  title: { en: "Car brands", uk: "Автомобільні бренди" },
  fieldSchema: [
    { role: "logo", kind: "image", wikidataProp: "P154" },
    { role: "originCountries", kind: "entityRefList", wikidataProp: "P495/P17" },
    { role: "inception", kind: "date", wikidataProp: "P571" },
  ],
  requiredRoles: ["logo", "originCountries"],
  query: `
SELECT ?item ?sitelinks ?logo ?inception ${labelVars}
       (GROUP_CONCAT(DISTINCT STRAFTER(STR(?ctr), "entity/"); separator="|") AS ?ctrs)
WHERE {
  ?item wdt:P31/wdt:P279* wd:Q786820 .   # automobile manufacturer
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 25)
  ${labelClauses}
  OPTIONAL { ?item wdt:P154 ?logo . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { { ?item wdt:P495 ?ctr . } UNION { ?item wdt:P17 ?ctr . } }
}
GROUP BY ?item ?sitelinks ?logo ?inception ${labelVars}
LIMIT 500
`,
  normalize(row) {
    const qid = qidFromUri(row.item?.value ?? "");
    if (!qid) return null;
    const { labels, wikiLinks } = pickLabels(row);
    const logo = row.logo?.value ? commonsThumb(row.logo.value) : undefined;
    return {
      qid,
      labels,
      wikiLinks,
      sitelinks: Number(row.sitelinks?.value ?? 0),
      imageUrl: logo,
      values: {
        logo,
        inception: row.inception?.value,
        originCountries: row.ctrs?.value ? row.ctrs.value.split("|").filter(Boolean) : [],
      },
    };
  },
};

export const PRESETS: Record<string, TopicPreset> = {
  [countries.key]: countries,
  [carBrands.key]: carBrands,
};
