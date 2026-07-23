"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";
import type { ChoiceCard, ChoiceOption } from "@/lib/deck/types";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { ResultScreen, StatusBar, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

const SWIPE_THRESHOLD = 80;

interface Props {
  title: string;
  /** Cards built with optionCount: 2 — prompt on top, a pair of cards "in hand". */
  cards: ChoiceCard[];
  onFinish?: (r: SessionResult) => void;
}

/**
 * Duel layout of `choice` — a pair of playing cards held in hand (tilted,
 * slightly overlapping). Touch devices: fling the pair toward the answer.
 * Mouse: hover lifts a card, click picks it. Keyboard: ← →.
 */
export function SwipeDuelBoard({ title, cards, onFinish }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const touch = useCoarsePointer();
  const x = useMotionValue(0);

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

      {/* prompt (image + label — e.g. brand logo above the brand name) */}
      <div
        className={`flex flex-col items-center justify-center gap-1 text-center ${
          card.prompt.image ? "h-40" : "h-24"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-2"
          >
            {card.prompt.image && (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink
              <img
                src={card.prompt.image}
                alt=""
                className="max-h-20 max-w-40 object-contain drop-shadow-lg"
              />
            )}
            {(card.prompt.label || card.prompt.tmpl) && (
              <span className="font-display text-2xl font-bold tracking-tight">
                {card.prompt.label ?? t(`tmpl.${card.prompt.tmpl}`, card.prompt.params ?? {})}
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
              <span className="text-xs text-muted">
                {touch ? t("duelHintTouch") : t("duelHintMouse")}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the hand: two tilted, slightly overlapping playing cards */}
      <div className="relative min-h-0 flex-1 select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.2 }}
            className="flex h-full items-center justify-center"
          >
            {card.options.map((o, i) => (
              <HandCard
                key={o.key}
                option={o}
                side={i === 0 ? "left" : "right"}
                x={touch ? x : null}
                picked={s.picked}
                correctKey={card.correctKey}
                onPick={() => pick(o)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* touch-only drag layer: fling anywhere on the stage */}
        {touch && !s.picked && (
          <motion.div
            className="absolute inset-0 z-20"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            style={{ x }}
            onDragEnd={onDragEnd}
          />
        )}
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}

/** One playing card in the hand: base tilt; drag/hover straightens and lifts it. */
function HandCard({
  option,
  side,
  x,
  picked,
  correctKey,
  onPick,
}: {
  option: ChoiceOption;
  side: "left" | "right";
  /** MotionValue while touch-dragging, null on mouse devices. */
  x: MotionValue<number> | null;
  picked: string | null;
  correctKey: string;
  onPick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const left = side === "left";
  const baseRotate = left ? -8 : 8;

  // Touch: transforms driven by the drag position
  const zero = useMotionValue(0);
  const range = left ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD];
  const rotate = useTransform(x ?? zero, range, left ? [0, baseRotate] : [baseRotate, 0]);
  const y = useTransform(x ?? zero, range, left ? [-16, 10] : [10, -16]);
  const scale = useTransform(x ?? zero, range, left ? [1.06, 1] : [1, 1.06]);

  const isCorrect = option.key === correctKey;
  const state = !picked
    ? "idle"
    : isCorrect
      ? "correct"
      : option.key === picked
        ? "wrong"
        : "dim";

  return (
    <motion.button
      onClick={onPick}
      disabled={!!picked}
      style={
        x
          ? { rotate, y, scale, transformOrigin: "bottom center" }
          : { rotate: baseRotate, transformOrigin: "bottom center" }
      }
      whileHover={!x ? { rotate: 0, y: -14, scale: 1.05, zIndex: 10 } : undefined}
      className={`glass-card relative aspect-[5/7] w-[44%] max-w-52 p-3 shadow-xl transition-colors ${
        left ? "-mr-4 z-[1]" : "-ml-4"
      } ${
        state === "correct"
          ? "border-success shadow-glow"
          : state === "wrong"
            ? "border-danger"
            : state === "dim"
              ? "opacity-40"
              : ""
      }`}
    >
      {/* playing-card corner pips */}
      <span className="absolute left-2.5 top-2 font-display text-xs font-bold text-muted">
        {left ? "A" : "B"}
      </span>
      <span className="absolute bottom-2 right-2.5 rotate-180 font-display text-xs font-bold text-muted">
        {left ? "A" : "B"}
      </span>

      <span className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-line/60 p-2">
        {option.image && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
          <img
            src={option.image}
            alt=""
            onError={() => setImgFailed(true)}
            className="max-h-[70%] max-w-full rounded-md object-contain drop-shadow-lg"
          />
        ) : option.emoji ? (
          <span className="text-6xl">{option.emoji}</span>
        ) : option.image && imgFailed && !option.label ? (
          <ImageOff size={40} className="text-muted opacity-50" />
        ) : null}
        {option.label && (
          <span className="text-center text-sm font-semibold leading-tight">{option.label}</span>
        )}
      </span>
    </motion.button>
  );
}
