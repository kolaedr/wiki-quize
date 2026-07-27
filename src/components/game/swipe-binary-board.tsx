"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImageOff, X } from "lucide-react";
import type { BinaryCard } from "@/lib/deck/types";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { ResultScreen, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

const SWIPE_THRESHOLD = 90;

interface Props {
  cards: BinaryCard[];
  onFinish?: (r: SessionResult) => void;
  nextHref?: string;
  backHref?: string;
}

/**
 * True/false mechanic: one statement card in the center of a stack.
 * Swipe RIGHT = true, LEFT = false (the card itself flies away).
 * Mouse devices: ✗ / ✓ buttons. Keyboard: ← false, → true.
 */
export function SwipeBinaryBoard({ cards, onFinish, nextHref, backHref }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const touch = useCoarsePointer();
  const x = useMotionValue(0);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [s.idx]);

  const rotate = useTransform(x, [-160, 160], [-10, 10]);
  const trueOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const falseOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const card = cards[s.idx];
  if (s.done || !card) {
    return (
      <ResultScreen
        score={s.score}
        best={s.best}
        lives={s.lives}
        maxLives={s.maxLives}
        results={s.results}
        total={cards.length}
        onRestart={s.restart}
        nextHref={nextHref}
        backHref={backHref}
      />
    );
  }

  const pick = (saidTrue: boolean) =>
    s.answer(saidTrue ? "true" : "false", saidTrue === card.isTrue);

  const onDragEnd = (
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    // distance OR a flick commits the answer — the card feels thrown
    if (info.offset.x >= SWIPE_THRESHOLD || info.velocity.x > 800) pick(true);
    else if (info.offset.x <= -SWIPE_THRESHOLD || info.velocity.x < -800) pick(false);
  };

  const answered = s.picked !== null;
  const wasCorrect = answered && s.picked === (card.isTrue ? "true" : "false");

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-10 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") pick(false);
        if (e.key === "ArrowRight") pick(true);
      }}
    >
      <div className="flex h-10 items-center justify-center">
        <span className="text-xs text-muted">
          {touch ? t("binaryHintTouch") : t("binaryHintMouse")}
        </span>
      </div>

      {/* card stack */}
      <div className="relative min-h-0 flex-1 touch-none select-none">
        {/* next card peeking underneath */}
        {cards[s.idx + 1] && (
          <div className="glass-card absolute inset-x-6 bottom-2 top-6 rotate-2 opacity-40" />
        )}

        <AnimatePresence mode="wait">
          {/* OUTER: owns enter/exit only — no style motion value, so the exit
              (incl. the sideways fly-off) always settles and mode="wait" lets the
              next card in. INNER owns the live drag; mixing a style motion value
              with an exit target on the SAME x/rotate is what stalled the leave. */}
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: answered ? (s.picked === "true" ? 420 : -420) : 0,
              y: answered ? -60 : 0,
              rotate: answered ? (s.picked === "true" ? 25 : -25) : 0,
            }}
            transition={{ duration: 0.35, ease: [0.2, 0.6, 0.4, 1] }}
            className="absolute inset-0"
          >
          <motion.div
            drag={!answered}
            dragSnapToOrigin
            dragElastic={0.9}
            dragMomentum={false}
            style={{ x, rotate }}
            onDragEnd={onDragEnd}
            className={`glass-card absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center ${
              answered ? (wasCorrect ? "border-success shadow-success ring-2 ring-success" : "border-danger") : ""
            } ${touch ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {card.image && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ fallback
              <img
                src={card.image}
                alt=""
                onError={() => setImgFailed(true)}
                className="max-h-[45%] max-w-[80%] rounded-lg object-contain drop-shadow-lg"
              />
            ) : card.image && imgFailed ? (
              card.emoji ? (
                <span className="text-7xl">{card.emoji}</span>
              ) : (
                <ImageOff size={44} className="text-muted opacity-50" />
              )
            ) : null}
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
