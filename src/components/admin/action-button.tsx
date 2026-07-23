"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/actions";

interface Props {
  label: string;
  action: () => Promise<ActionResult>;
  variant?: "default" | "secondary" | "ghost";
}

/** Button bound to a server action, with pending state + inline result message. */
export function ActionButton({ label, action, variant = "default" }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => start(async () => setResult(await action()))}
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        {label}
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
