"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { setUserRoleAction } from "@/lib/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * One user row: shows name/email + role, with a button to grant/revoke the
 * game-moderator role. Super-admins (env/DB) are locked — their access is
 * controlled outside this screen.
 */
export function UserRoleRow({
  id,
  name,
  email,
  role: initialRole,
  createdAt,
  locked,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  locked: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const isMod = role === "moderator";
  const toggle = () => {
    const next = isMod ? "user" : "moderator";
    start(async () => {
      const r = await setUserRoleAction(id, next);
      setMsg(r.ok ? null : r.message);
      if (r.ok) setRole(next);
    });
  };

  return (
    <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          <span className="truncate">{name || "—"}</span>
          {locked ? (
            <Badge variant="success">
              <ShieldCheck size={11} /> супер-адмін
            </Badge>
          ) : isMod ? (
            <Badge variant="outline">модератор ігор</Badge>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted">
          {email} · з {new Date(createdAt).toLocaleDateString("uk-UA")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {msg && <span className="text-[11px] text-danger">{msg}</span>}
        {locked ? (
          <span className="text-[11px] text-muted">керується через ENV</span>
        ) : (
          <Button size="sm" variant={isMod ? "ghost" : "secondary"} disabled={pending} onClick={toggle}>
            {pending && <Loader2 size={13} className="animate-spin" />}
            {isMod ? "Зняти модератора" : "Зробити модератором"}
          </Button>
        )}
      </div>
    </div>
  );
}
