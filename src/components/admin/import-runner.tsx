"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getJobAction, importTickAction, startImportJobAction } from "@/lib/admin/actions";
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
  const [view, setView] = useState<JobView | null>(null);
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const created = useRef(false);

  const createJob = useCallback(async () => {
    setErr(null);
    const s = await startImportJobAction(topicSlug);
    if (!s.ok || !s.jobId) {
      setErr(s.message ?? "не вдалося створити джоб");
      return;
    }
    setView(await getJobAction(s.jobId));
  }, [topicSlug]);

  useEffect(() => {
    if (autoStart && !created.current) {
      created.current = true;
      createJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const runBatches = async (count: number) => {
    if (!view || running || view.done) return;
    setRunning(true);
    let v = view;
    for (let i = 0; i < count && !v.done; i++) {
      v = await importTickAction(v.jobId);
      setView(v);
    }
    setRunning(false);
    if (v.done && v.status === "done") router.refresh();
  };

  if (!view)
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant="secondary" onClick={createJob}>
          <Play size={13} /> {label}
        </Button>
        {err && <span className="text-xs text-danger">{err}</span>}
      </div>
    );

  const totalBands = view.bands.length;
  const remaining = totalBands - view.bandIndex + (view.phase === "done" ? 0 : 1); // + finalize
  const pct = Math.round((view.bandIndex / (totalBands + 1)) * 100);

  return (
    <div className="glass-card flex w-full max-w-md flex-col gap-2 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-fg">
          Джоб імпорту · {view.accepted} айтемів
        </span>
        <span
          className={
            view.status === "failed"
              ? "text-danger"
              : view.status === "done"
                ? "text-success"
                : "text-muted"
          }
        >
          {view.status}
        </span>
      </div>

      {/* progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
        <div
          className={`h-full transition-all ${view.status === "failed" ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${view.done ? 100 : pct}%` }}
        />
      </div>

      {/* batch table */}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-line/60 text-xs">
        {view.bands.map((b, i) => {
          const done = i < view.bandIndex;
          const current = i === view.bandIndex && view.phase === "fetch";
          return (
            <div key={i} className="flex items-center gap-2 border-t border-line/40 p-1.5 first:border-t-0">
              {done ? (
                <Check size={12} className="text-success" />
              ) : current && running ? (
                <Loader2 size={12} className="animate-spin text-accent" />
              ) : (
                <Circle size={10} className={current ? "text-accent" : "text-muted"} />
              )}
              <span className={done ? "text-muted line-through" : current ? "text-fg" : "text-muted"}>
                Батч {i + 1}: популярність {b.max ? `${b.min}–${b.max}` : `${b.min}+`}
              </span>
            </div>
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

      {view.message && <p className="text-[11px] text-muted">{view.message}</p>}

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
