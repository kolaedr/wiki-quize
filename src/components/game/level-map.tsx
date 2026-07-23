"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Lock, Star } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { useProgress } from "@/stores/progress";

interface Props {
  slug: string;
  title: string;
  icon?: string;
  levels: number;
}

/** Game-pass style level map: level N unlocks after completing N-1. */
export function LevelMap({ slug, title, icon, levels }: Props) {
  const t = useTranslations();
  const progress = useProgress();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-3">
          <GameIcon name={icon} size={28} />
          <div>
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted">{t("levels.subtitle", { levels })}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {Array.from({ length: levels }, (_, i) => i + 1).map((n) => {
            const unlocked = mounted && progress.isUnlocked(slug, n);
            const done = mounted && progress.isCompleted(slug, n);
            const inner = (
              <span
                className={`glass-card flex aspect-square flex-col items-center justify-center gap-1 transition-all ${
                  done
                    ? "border-success"
                    : unlocked
                      ? "hover:border-accent active:scale-95"
                      : "opacity-40"
                }`}
              >
                {done ? (
                  <Check size={18} className="text-success" />
                ) : unlocked ? (
                  <Star size={18} className="text-accent" />
                ) : (
                  <Lock size={16} className="text-muted" />
                )}
                <span className="text-sm font-semibold">{n}</span>
              </span>
            );
            return unlocked ? (
              <Link key={n} href={`/play/${slug}/${n}`}>
                {inner}
              </Link>
            ) : (
              <span key={n} aria-disabled>
                {inner}
              </span>
            );
          })}
        </div>

        <p className="text-center text-xs leading-5 text-muted">{t("levels.hint")}</p>
      </main>
    </>
  );
}
