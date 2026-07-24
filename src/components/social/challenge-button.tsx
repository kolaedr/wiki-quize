"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createChallengeAction } from "@/lib/social/actions";

/** Throw a challenge on a game and copy the sharable /challenge link. */
export function ChallengeButton({ gameSlug }: { gameSlug: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = () =>
    start(async () => {
      setError(null);
      setCopied(false);
      const r = await createChallengeAction(gameSlug);
      if (!r.ok || !r.token) {
        setError(r.message);
        return;
      }
      const link = `${window.location.origin}/challenge?ch=${r.token}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        /* ignore */
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="glass" disabled={pending} onClick={make}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
        Кинути челендж
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
          {copied && (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check size={13} /> скопійовано
            </span>
          )}
          {!copied && (
            <button type="button" onClick={() => navigator.clipboard?.writeText(url)}>
              <Copy size={14} className="text-muted" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
