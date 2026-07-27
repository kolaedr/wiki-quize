"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, Star } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { MAX_STARS, useProgress } from "@/stores/progress";

interface Props {
  slug: string;
  title: string;
  icon?: string;
  /** game cover (style.cover) — same picture the catalog card shows */
  cover?: string;
  levels: number;
  /** account progress ({level: stars}); empty for guests */
  serverStars?: Record<number, number>;
  children?: React.ReactNode;
}

/** Game-pass style level map: level N unlocks after completing N-1. */
export function LevelMap({
  slug,
  title,
  icon,
  cover,
  levels,
  serverStars = {},
  children,
}: Props) {
  const t = useTranslations();
  const progress = useProgress();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The account and this device can each know about clears the other doesn't
  // (played signed out, or on another phone). Take the union, best rating wins —
  // signing in should only ever ADD to what you see.
  const clearedOn = (n: number) => (serverStars[n] ?? 0) > 0 || progress.isCompleted(slug, n);
  const starsOn = (n: number) => Math.max(serverStars[n] ?? 0, progress.starsFor(slug, n));

  return (
    <>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-5">
        <div className="flex items-center gap-3">
          {/* the cover is what the catalog card shows — keep the same picture
              here instead of dropping back to the generic icon */}
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
            <img
              src={cover}
              alt=""
              className="h-14 w-16 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <GameIcon name={icon} size={28} />
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted">{t("levels.subtitle", { levels })}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
          {Array.from({ length: levels }, (_, i) => i + 1).map((n) => {
            // server progress is known at render time; the local store only
            // after mount (localStorage), hence the `mounted` guard on it
            const done = (serverStars[n] ?? 0) > 0 || (mounted && progress.isCompleted(slug, n));
            const unlocked =
              n === 1 || clearedOn(n - 1) || (mounted && progress.isUnlocked(slug, n));
            const stars = done ? starsOn(n) : 0;
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
                  // rating out of three — one star per life left at the end,
                  // so a clean run is three and a scrape-through is one.
                  // Laid out on a shallow arc (outer stars tilted and dropped,
                  // middle one raised and larger) instead of a flat row.
                  <span
                    className="flex items-end space-x-1 pt-0.5"
                    title={`${stars}/${MAX_STARS}`}
                  >
                    {Array.from({ length: MAX_STARS }, (_, i) => {
                      const middle = i === 1;
                      const arc = middle
                        ? "-translate-y-1"
                        : i === 0
                          ? "-rotate-[22deg] translate-y-0.5"
                          : "rotate-[22deg] translate-y-0.5";
                      return (
                        <Star
                          key={i}
                          size={middle ? 20 : 16}
                          className={`${arc} ${
                            i < stars
                              ? "fill-accent-2 text-accent-2 drop-shadow-sm"
                              : "fill-none text-muted opacity-40"
                          }`}
                        />
                      );
                    })}
                  </span>
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
      {children}
      </main>
    </>
  );
}
