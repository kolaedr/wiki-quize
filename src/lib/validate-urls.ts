/**
 * Image URL availability check — used by the seed script and the live
 * ingest so no fake/broken image ever reaches the game.
 *
 * Commons throttles bursts, so: modest concurrency, retries with backoff
 * on 429/timeouts. Callers should ALSO apply a meta-guard: if known-good
 * URLs fail en masse, the network (not the files) is broken — trust the
 * URLs instead of punishing the data.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function filterWorkingUrls(
  urls: (string | undefined | null)[],
  concurrency = 5,
): Promise<Set<string>> {
  const ok = new Set<string>();
  const queue = [...new Set(urls.filter((u): u is string => !!u))];

  async function attempt(url: string, method: "HEAD" | "GET") {
    return fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
  }

  async function check(url: string, tries = 0): Promise<void> {
    try {
      let res = await attempt(url, "HEAD");
      if (res.status === 429 && tries < 2) {
        await sleep(1200 * (tries + 1));
        return check(url, tries + 1);
      }
      // Some proxies reject HEAD — retry with GET and discard the body.
      if (!res.ok && res.status !== 404) {
        res = await attempt(url, "GET");
      }
      if (res.ok) ok.add(url);
      await res.body?.cancel().catch(() => {});
    } catch {
      // network hiccup / timeout — one retry before giving up
      if (tries < 1) {
        await sleep(800);
        return check(url, tries + 1);
      }
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const url = queue.pop();
      if (url) await check(url);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, worker),
  );
  return ok;
}
