"use client";

import { useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInviteAction } from "@/lib/social/actions";
import { ShareDialog } from "@/components/social/share-dialog";

/** Generate an invite link for a team → opens a share modal (link + QR + share). */
export function InviteButton({ teamId, teamName }: { teamId: string; teamName?: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const make = () =>
    start(async () => {
      setError(null);
      const r = await createInviteAction(teamId);
      if (!r.ok || !r.token) {
        setError(r.message);
        return;
      }
      setUrl(`${window.location.origin}/join?inv=${r.token}`);
      setOpen(true);
    });

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="secondary" className="self-start" disabled={pending} onClick={make}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
        Створити інвайт-лінк
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[11px] text-muted">
        Поділись лінком або QR — хто відкриє, приєднається до команди (після
        реєстрації, якщо ще без акаунта).
      </p>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title={teamName ? `Запросити в «${teamName}»` : "Запрошення в команду"}
        url={url ?? ""}
        hint="Хай відсканує код або відкриє лінк, щоб приєднатись"
        shareText={teamName ? `Приєднуйся до команди «${teamName}» у WikiQuize` : "Приєднуйся до моєї команди у WikiQuize"}
      />
    </div>
  );
}
