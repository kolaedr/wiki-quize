"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Flame, Heart, Percent, RotateCcw, Star, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_STARS } from "@/stores/progress";

/**
 * Shared HUD bits for all game boards: lives, streak, result screen.
 *
 * The old StatusBar (title + counter + progress line above the board) is gone:
 * the title now lives in the site header as a subline, the counter and progress
 * moved to the bottom bar, and lives sit in the game's top row. That reclaimed
 * roughly one and a half rows of vertical space on a phone.
 */

/**
 * Blur for the question image (config `promptBlur`), cleared the moment an
 * answer is picked. Inline style rather than a Tailwind class because the
 * radius is admin-configurable, and JIT can't generate arbitrary values that
 * only exist in the database.
 */
export function blurStyle(px: number | undefined, revealed: boolean): React.CSSProperties | undefined {
  if (!px || px <= 0) return undefined;
  return {
    filter: revealed ? "blur(0px)" : `blur(${px}px)`,
    transition: "filter 420ms ease-out",
  };
}

export function Lives({ lives, maxLives }: { lives: number; maxLives: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${lives}/${maxLives}`}>
      {Array.from({ length: maxLives }, (_, i) => (
        <Heart
          key={i}
          size={24}
          className={
            i < lives
              ? "fill-danger text-danger"
              : "fill-none text-muted opacity-40"
          }
        />
      ))}
    </span>
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
  maxLives = MAX_STARS,
  results = [],
  total,
  onRestart,
  nextHref,
  backHref,
}: {
  score: number;
  best: number;
  lives: number;
  maxLives?: number;
  /** per-card outcomes — drives the hit counter and accuracy */
  results?: boolean[];
  /** deck size, so an aborted run still reads "4/10" rather than "4/4" */
  total?: number;
  onRestart: () => void;
  /** next level — offered only when the deck was passed (lives > 0) */
  nextHref?: string;
  /** back to the level map / catalog */
  backHref?: string;
}) {
  const t = useTranslations("game");
  const passed = lives > 0;
  const canNext = passed && !!nextHref;
  const answered = results.length;
  const correct = results.filter(Boolean).length;
  const deck = total ?? answered;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  // lives left == the star rating stored in the progress store
  const stars = Math.min(maxLives, Math.max(0, lives));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
      <div className="glass-card shadow-glow flex w-full max-w-sm flex-col items-center gap-5 overflow-hidden p-7">
        {/* headline: the rating IS the reward, so it leads */}
        <div className="flex flex-col items-center gap-3">
          <span className="flex items-end gap-1.5">
            {Array.from({ length: maxLives }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.08 * i, type: "spring", stiffness: 320, damping: 16 }}
                // the middle star sits higher — a podium, not a flat row
                className={i === 1 ? "-translate-y-1.5" : ""}
              >
                <Star
                  size={i === 1 ? 40 : 32}
                  className={
                    i < stars
                      ? "fill-accent-2 text-accent-2 drop-shadow-md"
                      : "fill-none text-muted opacity-30"
                  }
                />
              </motion.span>
            ))}
          </span>

          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-2xl font-bold leading-tight">
              {passed ? t("result") : t("failed")}
            </h2>
            <p className="text-xs text-muted">
              {passed ? t("resultHint") : t("failedHint")}
            </p>
          </div>
        </div>

        {/* score — the one big number */}
        <div className="flex w-full flex-col items-center gap-0.5 rounded-2xl bg-accent-soft/50 py-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t("scoreLabel")}
          </span>
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.24, type: "spring", stiffness: 260, damping: 18 }}
            className="font-display text-4xl font-bold leading-none text-accent"
          >
            {score}
          </motion.span>
        </div>

        {/* three supporting numbers, so the card isn't one lonely figure */}
        <div className="grid w-full grid-cols-3 gap-2">
          <Stat icon={<Target size={13} />} label={t("correct")} value={`${correct}/${deck}`} />
          <Stat icon={<Flame size={13} />} label={t("streak")} value={`×${best}`} />
          <Stat icon={<Percent size={13} />} label={t("accuracy")} value={`${accuracy}%`} />
        </div>

        {/* actions: retry keeps its square, the primary CTA eats the rest */}
        <div className="flex w-full items-center gap-2">
          <Button
            onClick={onRestart}
            size="lg"
            variant={canNext ? "glass" : "default"}
            className={canNext ? "w-12 shrink-0 px-0" : "flex-1"}
            aria-label={t("playAgain")}
            title={t("playAgain")}
          >
            <RotateCcw size={18} />
            {!canNext && t("playAgain")}
          </Button>
          {canNext && (
            <Button asChild size="lg" className="flex-1">
              <Link href={nextHref!}>
                {t("nextLevel")} <ArrowRight size={16} />
              </Link>
            </Button>
          )}
        </div>

        {backHref && (
          <Link
            href={backHref}
            className="-mt-1 text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent"
          >
            {t("backToLevels")}
          </Link>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-line/60 py-2">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  );
}
