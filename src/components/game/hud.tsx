"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Flame, Heart, RotateCcw, Sparkles, MoonStar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/** Shared HUD bits for all game boards: status row, progress, streak, result screen. */

export function StatusBar({
  title,
  idx,
  total,
  lives,
  maxLives,
}: {
  title: string;
  idx: number;
  total: number;
  lives: number;
  maxLives: number;
}) {
  return (
    <>
      <div className="flex items-center justify-between py-3 text-sm">
        <span className="font-display font-semibold">{title}</span>
        <div className="flex items-center gap-4">
          <span className="text-muted">
            {Math.min(idx + 1, total)}/{total}
          </span>
          <span className="flex items-center gap-1">
            {Array.from({ length: maxLives }, (_, i) => (
              <Heart
                key={i}
                size={15}
                className={
                  i < lives ? "fill-danger text-danger" : "fill-none text-muted opacity-40"
                }
              />
            ))}
          </span>
        </div>
      </div>
      <Progress value={(idx / total) * 100} className="mb-3 h-1" />
    </>
  );
}

export function StreakBadge({ streak }: { streak: number }) {
  const t = useTranslations("game");
  return (
    <div className="flex h-8 items-center justify-center text-xs text-muted">
      {streak > 1 && (
        <motion.span
          key={streak}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1 text-accent-2"
        >
          <Flame size={14} className="fill-accent-2 text-accent-2" />
          {t("streak")} ×{streak}
        </motion.span>
      )}
    </div>
  );
}

export function ResultScreen({
  score,
  best,
  lives,
  onRestart,
}: {
  score: number;
  best: number;
  lives: number;
  onRestart: () => void;
}) {
  const t = useTranslations("game");
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="glass-card shadow-glow flex w-full max-w-sm flex-col items-center gap-3 p-8">
        {lives > 0 ? (
          <Sparkles size={44} className="text-accent" />
        ) : (
          <MoonStar size={44} className="text-muted" />
        )}
        <h2 className="font-display text-2xl font-bold">{t("result")}</h2>
        <p className="text-4xl font-bold text-accent">{score}</p>
        <p className="text-sm text-muted">
          {t("bestStreak")}: {best}
        </p>
        <Button onClick={onRestart} size="lg" className="mt-2">
          <RotateCcw size={15} />
          {t("playAgain")}
        </Button>
      </div>
    </main>
  );
}
