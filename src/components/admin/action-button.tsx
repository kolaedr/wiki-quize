"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/admin/actions";

// server components can't pass a component across the boundary — map by name
const ICONS = { trash: Trash2, sync: RefreshCw, import: Upload } as const;
type IconName = keyof typeof ICONS;

interface Props {
  label: string;
  action: () => Promise<ActionResult>;
  variant?: "default" | "secondary" | "ghost" | "destructive";
  /** destructive: require a second click before firing */
  confirm?: boolean;
  /** optional leading icon, referenced by name */
  icon?: IconName;
  /** render just the icon (compact); `label` becomes the tooltip */
  iconOnly?: boolean;
}

/** Button bound to a server action, with pending state + inline result message. */
export function ActionButton({
  label,
  action,
  variant = "default",
  confirm = false,
  icon,
  iconOnly = false,
}: Props) {
  const Icon = icon ? ICONS[icon] : null;
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

  const glyph = pending ? <Loader2 size={14} className="animate-spin" /> : Icon ? <Icon size={14} /> : null;

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size={iconOnly ? "icon" : "sm"}
        variant={armed ? "destructive" : variant}
        disabled={pending}
        onClick={run}
        onBlur={() => setArmed(false)}
        title={iconOnly ? (armed ? `${label}? Клікни ще раз` : label) : undefined}
        aria-label={iconOnly ? label : undefined}
      >
        {glyph}
        {!iconOnly && (armed ? "Точно? Ще раз" : label)}
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
