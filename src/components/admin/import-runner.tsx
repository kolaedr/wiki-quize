"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getJobAction,
  getLatestJobAction,
  importTickAction,
  setJobStartAction,
  startImportJobAction,
} from "@/lib/admin/actions";
import type { JobView } from "@/lib/ingest/job";

/**
 * CONTROLLED batched import. Starting an import creates a job whose batches
 * (sitelinks bands) show as a table; the admin chooses how many batches to run
 * now (1 / N / all) and each run marks them off. Every batch is a short request
 * — nothing hangs, and it's steppable for testing.
 */
export function ImportRunner({
  topicSlug,
  autoStart = false,
  label = "Почати імпорт",
}: {
  topicSlug: string;
  autoStart?: boolean;
  label?: string;
}) {
  const router = useRouter();
  // what the user's own actions produced; null until they start/step a job
  const [override, setOverride] = useState<JobView | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [n, setN] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const created = useRef(false);

  const createJob = useCallback(
    async (fresh = false) => {
      setErr(null);
      setStarting(true);
      try {
        const s = await startImportJobAction(topicSlug, fresh);
        if (!s.ok || !s.jobId) {
          setErr(s.message ?? "не вдалося створити джоб");
          return;
        }
        setOverride(await getJobAction(s.jobId));
      } finally {
        setStarting(false);
      }
    },
    [topicSlug],
  );

  // The newest job for this dataset, so the queue (with its ticked-off batches)
  // is on screen the moment the tab opens instead of a bare button. As a query
  // it also survives tab switches from cache rather than refetching.
  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ["admin", "job", "latest", topicSlug],
    queryFn: () => getLatestJobAction(topicSlug),
  });

  /**
   * What's on screen: the user's own job wins, otherwise the last one from the
   * DB — a finished run stays visible (read-only) with ↻ to start a new one.
   * DERIVED, not copied into state by an effect: mirroring a query into
   * useState is the cascading-render pattern, and it also made the queue flash
   * empty for a frame on every tab switch.
   */
  const view = override ?? latest ?? null;

  // The only real side effect left: dataset setup wants a fresh import started
  // for it. Runs once, and never on top of a queue that's still going.
  useEffect(() => {
    if (created.current || loadingLatest || !autoStart) return;
    if (latest && !latest.done) return; // resume that one instead
    created.current = true;
    // starting a job IS a side effect, which is what effects are for; the rule
    // only fires because createJob flips its own pending flag on the way out
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot kick-off
    createJob();
  }, [loadingLatest, latest, autoStart, createJob]);

  const runBatches = async (count: number) => {
    if (!view || running || view.done) return;
    setRunning(true);
    let v = view;
    for (let i = 0; i < count && !v.done; i++) {
      v = await importTickAction(v.jobId);
      setOverride(v);
      if (v.error) break; // a batch failed — stop; the admin can retry it
    }
    setRunning(false);
    if (v.done && v.status === "done") router.refresh();
  };

  const jumpTo = async (i: number) => {
    if (!view || running) return;
    setOverride(await setJobStartAction(view.jobId, i));
  };

  if (!view)
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="secondary" onClick={() => createJob()} disabled={starting}>
          {starting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {starting ? "Готую чергу…" : label}
        </Button>
        {starting && (
          <span className="text-xs text-muted">
            Тягну список айтемів з Wikidata (може зайняти до ~1½ хв на великому класі)…
          </span>
        )}
        {err && <span className="text-xs text-danger">{err}</span>}
      </div>
    );

  const totalBatches = view.totalBatches;
  const remaining = totalBatches - view.batchIndex + (view.phase === "done" ? 0 : 1); // + finalize
  const pct = Math.round((view.batchIndex / (totalBatches + 1)) * 100);
  let pos = 0; // running item position for labels

  return (
    <div className="glass-card flex w-full max-w-md flex-col gap-2 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-fg">
          Черга імпорту · {totalBatches} батчів · {view.accepted} айтемів
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => createJob(true)}
            disabled={running || starting}
            title="Почати чергу заново (з новим списком айтемів)"
            className="text-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            <RefreshCw size={12} />
          </button>
          <span
            className={
              view.error || view.status === "failed"
                ? "text-danger"
                : view.status === "done"
                  ? "text-success"
                  : "text-muted"
            }
          >
            {view.error ? "збій батча" : view.status}
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
        <div
          className={`h-full transition-all ${view.status === "failed" ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${view.done ? 100 : pct}%` }}
        />
      </div>

      {/* batch table (by item count) */}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-line/60 text-xs">
        {view.batchSizes.map((size, i) => {
          const from = pos + 1;
          pos += size;
          const done = i < view.batchIndex;
          const current = i === view.batchIndex && view.phase === "fetch";
          const clickable = !running && !view.done;
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => jumpTo(i)}
              title={clickable ? "Почати з цього батча" : undefined}
              className={`flex w-full items-center gap-2 border-t border-line/40 p-1.5 text-left first:border-t-0 ${
                clickable ? "hover:bg-accent-soft/40" : ""
              }`}
            >
              {done ? (
                <Check size={12} className="text-success" />
              ) : current && running ? (
                <Loader2 size={12} className="animate-spin text-accent" />
              ) : (
                <Circle size={10} className={current ? "text-accent" : "text-muted"} />
              )}
              <span className={done ? "text-muted line-through" : current ? "text-fg" : "text-muted"}>
                Батч {i + 1}: {size} айтемів (№{from}–{pos})
              </span>
            </button>
          );
        })}
        <div className="flex items-center gap-2 border-t border-line/40 p-1.5">
          {view.phase === "done" ? (
            <Check size={12} className="text-success" />
          ) : (
            <Circle size={10} className={view.phase === "finalize" ? "text-accent" : "text-muted"} />
          )}
          <span className={view.phase === "done" ? "text-muted line-through" : "text-muted"}>
            Фінал: складність, чистка, ігри
          </span>
        </div>
      </div>

      {!view.done && (
        <p className="text-[10px] text-muted">
          Клікни батч, щоб почати з нього (пропустити пройдені або перепройти).
        </p>
      )}
      {view.message && (
        <p className={`text-[11px] ${view.error ? "text-danger" : "text-muted"}`}>{view.message}</p>
      )}

      {/* controls */}
      {!view.done && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={running} onClick={() => runBatches(1)}>
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}1 батч
          </Button>
          <span className="flex items-center gap-1">
            <Input
              type="number"
              className="h-8 w-16"
              value={n}
              onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))}
            />
            <Button size="sm" variant="secondary" disabled={running} onClick={() => runBatches(n)}>
              прогнати
            </Button>
          </span>
          <Button size="sm" variant="ghost" disabled={running} onClick={() => runBatches(remaining + 1)}>
            <RefreshCw size={12} /> усе
          </Button>
        </div>
      )}
    </div>
  );
}
