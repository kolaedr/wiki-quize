"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

/** Click cycles: system → light → dark → system. Icon shows the current mode. */
const CYCLE = ["system", "light", "dark"] as const;
type Mode = (typeof CYCLE)[number];

const ICONS: Record<Mode, React.ComponentType<{ size?: number | string }>> = {
  system: MonitorSmartphone,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current: Mode = mounted && CYCLE.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
  const Icon = ICONS[current];

  return (
    <Button
      variant="glass"
      size={compact ? "iconRoundSm" : "iconRound"}
      onClick={() => setTheme(next)}
      title={`${t(current)} → ${t(next)}`}
      aria-label={t(current)}
      className={compact ? "rounded-lg text-muted hover:text-accent" : "text-muted hover:text-accent"}
    >
      <Icon size={compact ? 14 : 18} />
    </Button>
  );
}
