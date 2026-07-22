"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/admin/actions";

interface Props {
  label: string;
  action: () => Promise<ActionResult>;
  variant?: "primary" | "ghost";
}

/** Button bound to a server action, with pending state + inline result message. */
export function ActionButton({ label, action, variant = "primary" }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await action()))}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${
          variant === "primary"
            ? "bg-accent text-white"
            : "glass-card text-muted hover:text-fg"
        }`}
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        {label}
      </button>
      {result && (
        <span className={`max-w-64 text-[11px] leading-4 ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </span>
      )}
    </span>
  );
}
