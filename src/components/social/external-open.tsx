"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Markers of in-app browsers (messengers) that mangle query params / cookies. */
const IN_APP = /(FBAN|FBAV|Instagram|Line|Twitter|TikTok|Snapchat|Viber|Telegram|WhatsApp|MicroMessenger|GSA)/i;

/**
 * Invite/challenge links get opened inside messenger web-views that lose query
 * and cookies. When we detect one, nudge the user to reopen in a real browser
 * and offer a copyable link so nothing is lost. Silent in normal browsers.
 */
export function ExternalOpen({ storageKey, token }: { storageKey: string; token: string }) {
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    // stash the token so a re-open / in-app sign-up can still recover it
    try {
      window.localStorage.setItem(storageKey, token);
    } catch {
      /* private mode — the URL still carries the token */
    }
    setUrl(window.location.href);
    setInApp(IN_APP.test(navigator.userAgent));
  }, [storageKey, token]);

  if (!inApp) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="glass-card flex flex-col gap-2 border-amber-500/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-500">
        <ExternalLink size={15} /> Відкрий у справжньому браузері
      </p>
      <p className="text-xs text-muted">
        Ти відкрив лінк усередині застосунку — тут реєстрація може не спрацювати.
        Натисни «⋯» вгорі й обери «Відкрити в браузері», або скопіюй лінк:
      </p>
      <div className="flex items-center gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button size="sm" variant="secondary" className="w-full">
            <ExternalLink size={14} /> Відкрити
          </Button>
        </a>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? "Скопійовано" : "Копіювати лінк"}
        </Button>
      </div>
    </div>
  );
}
