/**
 * Image URL availability check — used by the seed script and the live
 * ingest so no fake/broken image ever reaches the game (user rule:
 * "перевіряти доступність URL, щоб не було фейкових даних").
 */
export async function filterWorkingUrls(
  urls: (string | undefined | null)[],
  concurrency = 8,
): Promise<Set<string>> {
  const ok = new Set<string>();
  const queue = [...new Set(urls.filter((u): u is string => !!u))];

  async function check(url: string) {
    try {
      let res = await fetch(url, { method: "HEAD", redirect: "follow" });
      // Some proxies reject HEAD — retry with GET and discard the body.
      if (!res.ok && res.status !== 404) {
        res = await fetch(url, { method: "GET", redirect: "follow" });
      }
      if (res.ok) ok.add(url);
      await res.body?.cancel().catch(() => {});
    } catch {
      /* unreachable → not ok */
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
