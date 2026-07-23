"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/actions";

interface Props {
  label: string;
  action: () => Promise<ActionResult>;
  variant?: "default" | "secondary" | "ghost";
  /** destructive: require a second click ("точно?") before firing */
  confirm?: boolean;
}

/** Button bound to a server action, with pending state + inline result message. */
export function ActionButton({ label, action, variant = "default", confirm = false }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [armed, setArmed] = useState(false);

  const run = () => {
    if (confirm && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    start(async () => setResult(await action()));
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={armed ? "default" : variant}
        disabled={pending}
        onClick={run}
        onBlur={() => setArmed(false)}
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        {armed ? "Точно? Ще раз" : label}
      </Button>
      {result && (
        <span
          className={`max-w-64 text-right text-[11px] leading-4 ${
            result.ok ? "text-success" : "text-danger"
          }`}
        >
          {result.message}
        </span>
      )}
    </span>
  );
}
