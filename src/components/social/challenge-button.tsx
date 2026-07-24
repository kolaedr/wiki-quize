"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createChallengeAction } from "@/lib/social/actions";
import { ShareDialog } from "@/components/social/share-dialog";

/** Throw a challenge on a game → opens a share modal (link + QR + share). */
export function ChallengeButton({ gameSlug }: { gameSlug: string }) {
  const t = useTranslations("social");
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = () =>
    start(async () => {
      setError(null);
      // reuse an already-created link within this view instead of spawning a new one
      if (url) {
        setOpen(true);
        return;
      }
      const r = await createChallengeAction(gameSlug);
      if (!r.ok || !r.token) {
        setError(r.message);
        return;
      }
      setUrl(`${window.location.origin}/challenge?ch=${r.token}`);
      setOpen(true);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="glass" disabled={pending} onClick={make}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
        {t("challengeCta")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("challengeTitle")}
        url={url ?? ""}
        hint={t("challengeHint")}
        shareText={t("challengeShare")}
      />
    </div>
  );
}
