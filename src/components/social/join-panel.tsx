"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/lib/social/actions";

/**
 * Invite acceptance. Logged in → one tap joins the team. Not logged in → send
 * to auth with a redirect back here, so after sign-up they land on the same
 * invite and join.
 */
export function JoinPanel({
  token,
  loggedIn,
  teamName,
}: {
  token: string;
  loggedIn: boolean;
  teamName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const redirect = `/join?inv=${token}`;

  const join = () =>
    start(async () => {
      setError(null);
      const r = await acceptInviteAction(token);
      if (r.ok && r.teamId) {
        try {
          window.localStorage.removeItem("wq_pending_invite");
        } catch {
          /* ignore */
        }
        router.push(`/team/${r.teamId}`);
      } else setError(r.message);
    });

  if (!loggedIn)
    return (
      <div className="flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href={`/auth?redirect=${encodeURIComponent(redirect)}`}>
            <UserPlus size={16} /> Зареєструватись і приєднатись
          </Link>
        </Button>
        <p className="text-xs text-muted">
          Приєднаєшся до «{teamName}» одразу після реєстрації.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={pending} onClick={join}>
        {pending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        Приєднатись до «{teamName}»
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
