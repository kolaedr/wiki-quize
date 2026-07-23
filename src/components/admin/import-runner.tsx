"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importTickAction, startImportJobAction } from "@/lib/admin/actions";
import type { JobProgress } from "@/lib/ingest/job";

/**
 * Runs a batched import as a client-driven loop: start the job, then call one
 * tick at a time (each = one sitelinks band, a short request) with a progress
 * bar — so nothing hangs for minutes. Used after dataset setup (autoStart) and
 * as the "Синхронізувати" control on a configured dataset.
 */
export function ImportRunner({
  topicSlug,
  autoStart = false,
  label = "Синхронізувати з Wikidata",
}: {
  topicSlug: string;
  autoStart?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setProgress(null);
    const s = await startImportJobAction(topicSlug);
    if (!s.ok || !s.jobId) {
      setProgress({ jobId: "", status: "failed", phase: "done", step: 0, totalSteps: 1, accepted: 0, done: true, message: s.message });
      setRunning(false);
      return;
    }
    let p: JobProgress;
    do {
      p = await importTickAction(s.jobId);
      setProgress(p);
    } while (!p.done);
    setRunning(false);
    if (p.status === "done") router.refresh();
  }, [topicSlug, running, router]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const pct = progress ? Math.round((progress.step / progress.totalSteps) * 100) : running ? 5 : 0;
  const failed = progress?.status === "failed";
  const done = progress?.status === "done";

  return (
    <div className="flex flex-col gap-1.5">
      {!running && (!progress || failed) && (
        <Button size="sm" variant="secondary" onClick={run}>
          <RefreshCw size={13} /> {label}
        </Button>
      )}
      {(running || progress) && (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-accent-soft">
            <div
              className={`h-full transition-all ${failed ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={`flex items-center gap-1.5 text-xs ${
              failed ? "text-danger" : done ? "text-success" : "text-muted"
            }`}
          >
            {running && <Loader2 size={12} className="animate-spin" />}
            {progress?.message ?? "запуск батчів…"}
          </span>
        </>
      )}
    </div>
  );
}
