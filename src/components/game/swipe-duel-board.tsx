"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useTranslations } from "next-intl";
import type { ChoiceCard, ChoiceOption } from "@/lib/deck/types";
import { ResultScreen, StatusBar, StreakBadge } from "./hud";
import { useGameSession } from "./use-game-session";

const SWIPE_THRESHOLD = 70;

interface Props {
  title: string;
  /** Cards built with optionCount: 2 — prompt on top, two option cards below. */
  cards: ChoiceCard[];
}

/**
 * Duel layout of the `choice` mechanic — THE flagship feel:
 * question on top ("Germany"), two cards center-stage, fling the stage
 * left/right toward the correct one (tap also works). Keyboard: ← →.
 */
export function SwipeDuelBoard({ title, cards }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length);
  const x = useMotionValue(0);

  const leftScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1.07, 1]);
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD], [1, 1.07]);
  const leftGlow = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rightGlow = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);

  const card = cards[s.idx];
  if (s.done || !card) {
    return <ResultScreen score={s.score} best={s.best} lives={s.lives} onRestart={s.restart} />;
  }

  const pick = (o: ChoiceOption) => s.answer(o.key, o.key === card.correctKey);

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x <= -SWIPE_THRESHOLD) pick(card.options[0]);
    else if (info.offset.x >= SWIPE_THRESHOLD) pick(card.options[1]);
    x.set(0);
  };

  return (
    <main
      className="flex min-h-0 flex-1 flex-col px-4 pb-4 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") pick(card.options[0]);
        if (e.key === "ArrowRight") pick(card.options[1]);
      }}
    >
      <StatusBar title={title} idx={s.idx} total={cards.length} lives={s.lives} maxLives={s.maxLives} />

      {/* prompt */}
      <div className="flex h-24 flex-col items-center justify-center gap-1 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-1"
          >
            {card.prompt.label && (
              <span className="font-display text-3xl font-bold tracking-tight">
                {card.prompt.label}
              </span>
            )}
            {s.picked && card.explain.wikiUrl ? (
              <a
                href={card.explain.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline underline-offset-4"
              >
                {t("readMore")}
              </a>
            ) : (
              <span className="text-xs text-muted">{t("duelHint")}</span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* duel stage */}
      <div className="relative min-h-0 flex-1 select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 grid grid-cols-2 gap-3"
          >
            {card.options.map((o, i) => (
              <motion.div
                key={o.key}
                style={{ scale: i === 0 ? leftScale : rightScale }}
                className="h-full"
              >
                <OptionCard
                  option={o}
                  picked={s.picked}
                  correctKey={card.correctKey}
                  onTap={() => pick(o)}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* drag layer (fling anywhere on the stage) */}
        {!s.picked && (
          <motion.div
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            style={{ x }}
            onDragEnd={onDragEnd}
          />
        )}

        {/* direction hints */}
        <motion.span
          style={{ opacity: leftGlow }}
          className="pointer-events-none absolute left-2 top-1/2 z-20 -translate-y-1/2 text-3xl text-accent"
        >
          ◀
        </motion.span>
        <motion.span
          style={{ opacity: rightGlow }}
          className="pointer-events-none absolute right-2 top-1/2 z-20 -translate-y-1/2 text-3xl text-accent"
        >
          ▶
        </motion.span>
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}

function OptionCard({
  option,
  picked,
  correctKey,
  onTap,
}: {
  option: ChoiceOption;
  picked: string | null;
  correctKey: string;
  onTap: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isCorrect = option.key === correctKey;
  const state = !picked
    ? "idle"
    : isCorrect
      ? "correct"
      : option.key === picked
        ? "wrong"
        : "dim";

  return (
    <button
      onClick={onTap}
      disabled={!!picked}
      className={`glass-card flex h-full w-full flex-col items-center justify-center gap-2 p-4 transition-all active:scale-95 ${
        state === "correct"
          ? "border-success shadow-glow"
          : state === "wrong"
            ? "border-danger"
            : state === "dim"
              ? "opacity-40"
              : ""
      }`}
    >
      {option.image && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
        <img
          src={option.image}
          alt=""
          onError={() => setImgFailed(true)}
          className="max-h-[70%] max-w-full rounded-md object-contain drop-shadow-lg"
        />
      ) : option.emoji ? (
        <span className="text-7xl">{option.emoji}</span>
      ) : null}
      {option.label && <span className="text-sm font-semibold">{option.label}</span>}
    </button>
  );
}
