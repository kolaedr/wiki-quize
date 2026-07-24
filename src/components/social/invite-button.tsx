"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInviteAction } from "@/lib/social/actions";

/** Generate an invite link for a team and copy it to the clipboard. */
export function InviteButton({ teamId }: { teamId: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = () =>
    start(async () => {
      setError(null);
      setCopied(false);
      const r = await createInviteAction(teamId);
      if (!r.ok || !r.token) {
        setError(r.message);
        return;
      }
      const link = `${window.location.origin}/join?inv=${r.token}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        /* clipboard blocked — the field below is selectable */
      }
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={make}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
        Створити інвайт-лінк
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {url && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 rounded-lg border border-line/60 bg-transparent px-2 text-xs text-muted"
          />
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? "Скопійовано" : "Копіювати"}
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted">
        Поділись лінком у месенджері. Хто відкриє — приєднається до команди (після
        реєстрації, якщо ще не має акаунта).
      </p>
    </div>
  );
}
