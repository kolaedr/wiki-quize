"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import type { BinaryCard } from "@/lib/deck/types";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { ResultScreen, StatusBar, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

const SWIPE_THRESHOLD = 90;

interface Props {
  title: string;
  cards: BinaryCard[];
  onFinish?: (r: SessionResult) => void;
}

/**
 * True/false mechanic: one statement card in the center of a stack.
 * Swipe RIGHT = true, LEFT = false (the card itself flies away).
 * Mouse devices: ✗ / ✓ buttons. Keyboard: ← false, → true.
 */
export function SwipeBinaryBoard({ title, cards, onFinish }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const touch = useCoarsePointer();
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-160, 160], [-10, 10]);
  const trueOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const falseOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const card = cards[s.idx];
  if (s.done || !card) {
    return <ResultScreen score={s.score} best={s.best} lives={s.lives} onRestart={s.restart} />;
  }

  const pick = (saidTrue: boolean) =>
    s.answer(saidTrue ? "true" : "false", saidTrue === card.isTrue);

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x >= SWIPE_THRESHOLD) pick(true);
    else if (info.offset.x <= -SWIPE_THRESHOLD) pick(false);
    x.set(0);
  };

  const answered = s.picked !== null;
  const wasCorrect = answered && s.picked === (card.isTrue ? "true" : "false");

  return (
    <main
      className="flex min-h-0 flex-1 flex-col px-4 pb-4 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") pick(false);
        if (e.key === "ArrowRight") pick(true);
      }}
    >
      <StatusBar title={title} idx={s.idx} total={cards.length} lives={s.lives} maxLives={s.maxLives} />

      <div className="flex h-10 items-center justify-center">
        <span className="text-xs text-muted">
          {touch ? t("binaryHintTouch") : t("binaryHintMouse")}
        </span>
      </div>

      {/* card stack */}
      <div className="relative min-h-0 flex-1 select-none">
        {/* next card peeking underneath */}
        {cards[s.idx + 1] && (
          <div className="glass-card absolute inset-x-6 bottom-2 top-6 rotate-2 opacity-40" />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: answered ? (wasCorrect === card.isTrue ? 220 : -220) : 0,
              rotate: answered ? (card.isTrue ? 12 : -12) : 0,
            }}
            transition={{ duration: 0.22 }}
            drag={touch && !answered ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            style={{ x, rotate }}
            onDragEnd={onDragEnd}
            className={`glass-card absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center ${
              answered ? (wasCorrect ? "border-success shadow-glow" : "border-danger") : ""
            } ${touch ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <p className="font-display text-xl font-bold leading-8">
              {t(`tmpl.${card.tmpl}`, card.params)}
            </p>
            {answered && (
              <span className={`text-sm font-semibold ${card.isTrue ? "text-success" : "text-danger"}`}>
                {card.isTrue ? t("itWasTrue") : t("itWasFalse")}
              </span>
            )}
            {answered && card.explain.wikiUrl && (
              <a
                href={card.explain.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline underline-offset-4"
              >
                {t("readMore")}
              </a>
            )}

            {/* drag verdict badges */}
            <motion.span
              style={{ opacity: falseOpacity }}
              className="pointer-events-none absolute left-4 top-4 flex items-center gap-1 rounded-full border border-danger px-3 py-1 text-xs font-bold text-danger"
            >
              <X size={13} /> {t("false")}
            </motion.span>
            <motion.span
              style={{ opacity: trueOpacity }}
              className="pointer-events-none absolute right-4 top-4 flex items-center gap-1 rounded-full border border-success px-3 py-1 text-xs font-bold text-success"
            >
              <Check size={13} /> {t("true")}
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* buttons: primary input on mouse devices, duplicates on touch */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => pick(false)}
          disabled={answered}
          className="glass-card flex items-center justify-center gap-2 py-3 text-sm font-semibold text-danger transition-all hover:border-danger active:scale-95 disabled:opacity-40"
        >
          <X size={16} /> {t("false")}
        </button>
        <button
          onClick={() => pick(true)}
          disabled={answered}
          className="glass-card flex items-center justify-center gap-2 py-3 text-sm font-semibold text-success transition-all hover:border-success active:scale-95 disabled:opacity-40"
        >
          <Check size={16} /> {t("true")}
        </button>
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}
