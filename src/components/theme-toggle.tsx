"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/** Click cycles: system → light → dark → system. Icon shows the current mode. */
const CYCLE = ["system", "light", "dark"] as const;
type Mode = (typeof CYCLE)[number];

const ICONS: Record<Mode, React.ComponentType<{ size?: number | string }>> = {
  system: MonitorSmartphone,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current: Mode = mounted && CYCLE.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
  const Icon = ICONS[current];

  return (
    <button
      onClick={() => setTheme(next)}
      title={`${t(current)} → ${t(next)}`}
      aria-label={t(current)}
      className="glass-card flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-accent active:scale-95"
    >
      <Icon size={18} />
    </button>
  );
}
