"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

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
          <span className="tracking-widest">
            {Array.from({ length: maxLives }, (_, i) => (
              <span key={i} className={i < lives ? "text-danger" : "text-muted opacity-30"}>
                ♥
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-accent-soft">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(idx / total) * 100}%` }}
        />
      </div>
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
          className="text-accent-2"
        >
          🔥 {t("streak")} ×{streak}
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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="glass-card shadow-glow flex w-full max-w-sm flex-col items-center gap-3 p-8">
        <span className="text-5xl">{lives > 0 ? "✨" : "💫"}</span>
        <h2 className="font-display text-2xl font-bold">{t("result")}</h2>
        <p className="text-4xl font-bold text-accent">{score}</p>
        <p className="text-sm text-muted">
          {t("bestStreak")}: {best}
        </p>
        <button
          onClick={onRestart}
          className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white active:scale-95"
        >
          {t("playAgain")}
        </button>
      </div>
    </main>
  );
}
