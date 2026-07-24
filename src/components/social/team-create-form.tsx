"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTeamAction } from "@/lib/social/actions";

/** Create a team, then jump to its dashboard. */
export function TeamCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createTeamAction(name);
      if (r.ok && r.teamId) router.push(`/team/${r.teamId}`);
      else setError(r.message);
    });

  return (
    <div className="glass-card flex flex-col gap-2 p-4">
      <span className="text-sm font-semibold">Нова команда</span>
      <div className="flex items-center gap-2">
        <Input
          className="h-10 flex-1"
          placeholder="Напр. «Родина» або «5-Б клас»"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()}
        />
        <Button size="sm" disabled={pending || !name.trim()} onClick={submit}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Створити
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
