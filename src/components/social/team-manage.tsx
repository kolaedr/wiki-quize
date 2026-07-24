"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteTeamAction, leaveTeamAction } from "@/lib/social/actions";

/** Owner: delete the team. Member: leave it. Two-step confirm. */
export function TeamManage({ teamId, isOwner }: { teamId: string; isOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    start(async () => {
      setError(null);
      const r = isOwner ? await deleteTeamAction(teamId) : await leaveTeamAction(teamId);
      if (r.ok) router.push("/team");
      else {
        setError(r.message);
        setArmed(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={armed ? "destructive" : "ghost"}
        disabled={pending}
        onClick={run}
        onBlur={() => setArmed(false)}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isOwner ? (
          <Trash2 size={13} />
        ) : (
          <LogOut size={13} />
        )}
        {armed ? "Точно? Ще раз" : isOwner ? "Видалити команду" : "Вийти з команди"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
