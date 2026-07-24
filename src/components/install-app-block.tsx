"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "wq-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chromeOrFx = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !chromeOrFx;
}

/**
 * One Install button:
 * - Chromium with beforeinstallprompt → native install sheet
 * - iOS / other browsers → no install API; button reveals how-to steps
 */
export function InstallAppBlock() {
  const t = useTranslations("home");
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIosSafari());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || installed || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const onInstallClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    // No browser install API (iOS Safari, Firefox, localhost without SW, …)
    setShowHowTo(true);
  };

  return (
    <section className="glass-card relative flex flex-col gap-3 p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("installDismiss")}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:text-fg"
      >
        <X size={16} />
      </button>

      <div className="pr-8">
        <h2 className="font-display flex items-center gap-2 text-base font-semibold">
          <Download size={16} className="text-accent" aria-hidden />
          {t("installTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">{t("installBody")}</p>
      </div>

      <Button type="button" onClick={onInstallClick} className="self-start">
        <Download size={16} />
        {t("installCta")}
      </Button>

      {showHowTo && ios && (
        <ol className="flex flex-col gap-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <Share size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>{t("installIosStep1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <SquarePlus size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>{t("installIosStep2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <Download size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>{t("installIosStep3")}</span>
          </li>
        </ol>
      )}

      {showHowTo && !ios && (
        <p className="text-sm leading-6 text-muted">{t("installGeneric")}</p>
      )}
    </section>
  );
}
