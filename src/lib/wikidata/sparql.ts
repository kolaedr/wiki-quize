/**
 * Wikidata SPARQL client — INGEST ONLY, never called at game runtime.
 * Politeness: custom User-Agent + simple throttle (docs/PROJECT.md §5).
 */

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  process.env.WIKIMEDIA_UA ??
  "WikiQuiz/0.1 (https://wiqus.vercel.app; contact) ingest-script";

export type SparqlValue = { type: string; value: string };
export type SparqlRow = Record<string, SparqlValue | undefined>;

let lastCall = 0;
const MIN_INTERVAL_MS = 1_000;

export async function sparqlQuery(query: string): Promise<SparqlRow[]> {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ query }),
    cache: "no-store",
    // Fail cleanly instead of hanging until the serverless function is killed
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`SPARQL ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    results: { bindings: SparqlRow[] };
  };
  return json.results.bindings;
}

export const qidFromUri = (uri: string): string => uri.split("/").pop() ?? uri;

/** Normalize a Commons FilePath URI to https + bounded thumbnail width. */
export function commonsThumb(uri: string, width = 640): string {
  const u = uri.replace(/^http:/, "https:");
  return u.includes("?") ? `${u}&width=${width}` : `${u}?width=${width}`;
}
