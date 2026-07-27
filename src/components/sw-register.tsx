"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** How often an open app re-checks for a new deploy. */
const UPDATE_CHECK_MS = 5 * 60 * 1000;

/**
 * Registers the PWA service worker and surfaces updates.
 *
 * The worker deliberately does NOT skipWaiting on install, so a new deploy sits
 * in "waiting" until the user accepts. That avoids swapping JS chunks under a
 * running game (which throws chunk-load errors), and it's why an installed app
 * used to keep serving old code with no way out: nothing ever told the user,
 * and an installed PWA has no visible reload button.
 */
export function SwRegister() {
  const t = useTranslations("pwa");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    // a new worker took control — the fresh code is live, reload once to run it
    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const track = (reg: ServiceWorkerRegistration) => {
      // already parked from a previous visit
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          // "installed" + an existing controller = an UPDATE, not a first install
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            setDismissed(false);
            setWaiting(next);
          }
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        track(reg);
        // an installed app can stay open for days — poll, and check on refocus
        interval = setInterval(() => reg.update().catch(() => {}), UPDATE_CHECK_MS);
      })
      .catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      if (interval) clearInterval(interval);
    };
  }, []);

  const update = useCallback(() => {
    if (!waiting) return;
    // the worker calls skipWaiting(); controllerchange then reloads the page
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="glass-card shadow-glow flex w-full max-w-sm items-center gap-3 p-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold leading-tight">{t("updateTitle")}</span>
          <span className="text-[11px] leading-4 text-muted">{t("updateBody")}</span>
        </span>
        <Button size="sm" onClick={update}>
          <RefreshCw size={13} /> {t("updateCta")}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("later")}
          title={t("later")}
          className="text-muted transition-colors hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
