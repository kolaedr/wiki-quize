"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";
import type { ChoiceCard, ChoiceOption } from "@/lib/deck/types";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { ResultScreen, StatusBar, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

const THROW_DISTANCE = 110;
const THROW_VELOCITY = 900;

interface Props {
  title: string;
  /** Cards built with optionCount: 2 — prompt on top, a pair of cards "in hand". */
  cards: ChoiceCard[];
  onFinish?: (r: SessionResult) => void;
  nextHref?: string;
  backHref?: string;
}

/**
 * Duel layout of `choice` — a pair of playing cards held in hand.
 * THE CARD IS ALIVE: grab it, it follows your finger with tilt and lift;
 * throw it (distance or flick velocity) to pick it — it flies off with
 * your throw's momentum. Tap/click also picks. Keyboard: ← →.
 */
export function SwipeDuelBoard({ title, cards, onFinish, nextHref, backHref }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const touch = useCoarsePointer();

  const card = cards[s.idx];
  if (s.done || !card) {
    return (
      <ResultScreen
        score={s.score}
        best={s.best}
        lives={s.lives}
        onRestart={s.restart}
        nextHref={nextHref}
        backHref={backHref}
      />
    );
  }

  const pick = (o: ChoiceOption) => s.answer(o.key, o.key === card.correctKey);

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-4 outline-none"
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
          card.prompt.image ? "h-64" : "h-24"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-2"
          >
            {card.prompt.image && (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink
              // big question image: ~80% width so it's actually readable on mobile
              <img
                src={card.prompt.image}
                alt=""
                className="max-h-52 w-[80vw] max-w-md object-contain drop-shadow-lg"
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

      {/* the hand: two tilted cards, each one REALLY draggable */}
      <div className="relative min-h-0 flex-1 touch-none select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex h-full items-center justify-center"
          >
            {card.options.map((o, i) => (
              <ThrowableCard
                key={o.key}
                option={o}
                side={i === 0 ? "left" : "right"}
                picked={s.picked}
                correctKey={card.correctKey}
                onPick={() => pick(o)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}

/**
 * A live playing card: base hand-tilt at rest; while grabbed it follows the
 * finger (drag), tilts with horizontal offset and lifts; released past the
 * throw threshold (or flicked) it flies away along the throw vector.
 */
function ThrowableCard({
  option,
  side,
  picked,
  correctKey,
  onPick,
}: {
  option: ChoiceOption;
  side: "left" | "right";
  picked: string | null;
  correctKey: string;
  onPick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [thrown, setThrown] = useState<{ x: number; y: number; rotate: number } | null>(null);
  const left = side === "left";
  const baseRotate = left ? -8 : 8;

  const dx = useMotionValue(0);
  const dragTilt = useTransform(dx, [-160, 160], [-14, 14]);

  const isCorrect = option.key === correctKey;
  const state = !picked
    ? "idle"
    : isCorrect
      ? "correct"
      : option.key === picked
        ? "wrong"
        : "dim";

  return (
    // static wrapper keeps the resting hand-tilt; inner card moves freely
    <div
      className={`w-[44%] max-w-52 ${left ? "-mr-4 z-[1]" : "-ml-4"}`}
      style={{ rotate: `${baseRotate}deg`, transformOrigin: "bottom center" }}
    >
      <motion.button
        onClick={() => !thrown && onPick()}
        disabled={!!picked}
        drag={!picked && !thrown}
        dragSnapToOrigin
        dragElastic={0.9}
        dragMomentum={false}
        style={{ x: dx }}
        onDragEnd={(_, info) => {
          const dist = Math.hypot(info.offset.x, info.offset.y);
          const vel = Math.hypot(info.velocity.x, info.velocity.y);
          if (dist > THROW_DISTANCE || vel > THROW_VELOCITY) {
            // fly along the throw vector, keeping the momentum
            setThrown({
              x: info.offset.x * 3 + info.velocity.x * 0.35,
              y: info.offset.y * 3 + info.velocity.y * 0.35,
              rotate: info.offset.x > 0 ? 40 : -40,
            });
            onPick();
          }
        }}
        animate={
          thrown
            ? { x: thrown.x, y: thrown.y, rotate: thrown.rotate, opacity: 0, scale: 0.9 }
            : undefined
        }
        transition={thrown ? { duration: 0.45, ease: [0.2, 0.6, 0.4, 1] } : undefined}
        whileDrag={{ scale: 1.12, rotate: 0, zIndex: 40, cursor: "grabbing" }}
        whileHover={!picked ? { y: -10, scale: 1.04 } : undefined}
        className={`glass-card relative block aspect-[5/7] w-full cursor-grab p-3 shadow-xl transition-colors ${
          state === "correct"
            ? "border-success shadow-glow"
            : state === "wrong"
              ? "border-danger"
              : state === "dim"
                ? "opacity-40"
                : ""
        }`}
      >
        {/* live tilt while dragging */}
        <motion.span style={{ rotate: dragTilt }} className="flex h-full w-full">
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-line/60 p-2">
            {option.image && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
              <img
                src={option.image}
                alt=""
                draggable={false}
                onError={() => setImgFailed(true)}
                className="pointer-events-none max-h-[70%] max-w-full rounded-md object-contain drop-shadow-lg"
              />
            ) : option.emoji ? (
              <span className="text-6xl">{option.emoji}</span>
            ) : option.image && imgFailed && !option.label ? (
              <ImageOff size={40} className="text-muted opacity-50" />
            ) : null}
            {option.label && (
              <span className="text-center text-sm font-semibold leading-tight">
                {option.label}
              </span>
            )}
          </span>
        </motion.span>

        {/* playing-card corner pips */}
        <span className="absolute left-2.5 top-2 font-display text-xs font-bold text-muted">
          {left ? "A" : "B"}
        </span>
        <span className="absolute bottom-2 right-2.5 rotate-180 font-display text-xs font-bold text-muted">
          {left ? "A" : "B"}
        </span>
      </motion.button>
    </div>
  );
}
