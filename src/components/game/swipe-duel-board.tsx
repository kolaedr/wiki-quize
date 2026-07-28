"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { blurStyle, ResultScreen, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";
import { imageFrame } from "@/lib/image-frame";

const THROW_DISTANCE = 110;
const THROW_VELOCITY = 900;
/** Fan geometry — how far the hand splays and how much the cards overlap. */
const FAN_SPREAD_DEG = 11;
/** px each step out from the middle drops, so the hand curves */
const FAN_ARC_PX = 10;
/** px of horizontal bite taken out of the gap between neighbours */
const FAN_OVERLAP_PX = 34;
/** corner letters, like a real deck */
const PIPS = ["A", "B", "C", "D"];
/** hold this long to blow the card up for a proper look */
const LONG_PRESS_MS = 420;
/** a finger that travels this far is dragging, not holding */
const LONG_PRESS_SLOP_PX = 10;

interface Props {
  /** Cards built with optionCount: 2 — prompt on top, a pair of cards "in hand". */
  cards: ChoiceCard[];
  onFinish?: (r: SessionResult) => void;
  nextHref?: string;
  backHref?: string;
  promptBlur?: number;
  /** lay the cards out in a COLUMN instead of side by side */
  stacked?: boolean;
}

/**
 * Duel layout of `choice` — a pair of playing cards held in hand.
 * THE CARD IS ALIVE: grab it, it follows your finger with tilt and lift;
 * throw it (distance or flick velocity) to pick it — it flies off with
 * your throw's momentum. Tap/click also picks. Keyboard: ← →.
 */
export function SwipeDuelBoard({ cards, onFinish, nextHref, backHref, promptBlur, stacked = false }: Props) {
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
        maxLives={s.maxLives}
        results={s.results}
        total={cards.length}
        onRestart={s.restart}
        nextHref={nextHref}
        backHref={backHref}
      />
    );
  }

  const pick = (o: ChoiceOption) => s.answer(o.key, o.key === card.correctKey);

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-10 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") pick(card.options[0]);
        if (e.key === "ArrowRight") pick(card.options[1]);
      }}
    >
      {/* prompt (image + label — e.g. brand logo above the brand name) */}
      <div
        className={`flex shrink-0 flex-col items-center justify-center gap-1 text-center ${
          card.prompt.image ? (stacked ? "h-44" : "h-64") : "h-24"
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
              // big question image: ~80% width so it's actually readable on mobile
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink
              <img
                src={card.prompt.image}
                alt=""
                style={blurStyle(promptBlur, !!s.picked)}
                className={`max-h-52 ${stacked ? "w-[70%]" : "w-[80vw]"} max-w-md object-contain drop-shadow-lg ${imageFrame("rounded-xl")}`}
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

      {/* the hand: tilted cards, each one REALLY draggable.
          STACKED mode drops the fan and lists them vertically — a wide photo
          in a 44%-wide portrait card is a stamp, and geography decks are
          almost all landscape. */}
      <div className="relative min-h-0 flex-1 touch-none select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={
              stacked
                ? "flex h-full min-h-0 flex-col items-center justify-center gap-2"
                : // items-end + bottom-origin rotation = a hand of cards: the
                  // bottoms bunch together, the tops splay open
                  "flex h-full items-end justify-center pb-6"
            }
          >
            {card.options.map((o, i) => (
              <ThrowableCard
                key={o.key}
                option={o}
                index={i}
                count={card.options.length}
                stacked={stacked}
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
  index,
  count,
  stacked = false,
  picked,
  correctKey,
  onPick,
}: {
  option: ChoiceOption;
  index: number;
  count: number;
  stacked?: boolean;
  picked: string | null;
  correctKey: string;
  onPick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [thrown, setThrown] = useState<{ x: number; y: number; rotate: number } | null>(null);
  const [zoom, setZoom] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  // set when a long press fired, so the pointerup that follows doesn't ALSO
  // count as picking this card
  const suppressClick = useRef(false);

  /**
   * FAN GEOMETRY. Offset from the middle of the hand drives everything: the
   * tilt, and an extra drop for the outer cards so the row curves instead of
   * sitting on one line. Rotation happens about the BOTTOM of each card, so
   * the bottoms stay bunched while the tops open out — which is what a hand of
   * cards actually looks like. z-index climbs left→right so every card laps
   * the one before it.
   */
  const centre = index - (count - 1) / 2;
  const baseRotate = stacked ? 0 : centre * FAN_SPREAD_DEG;
  const arcDrop = stacked ? 0 : Math.abs(centre) * FAN_ARC_PX;

  const dx = useMotionValue(0);
  const dragTilt = useTransform(dx, [-160, 160], [-14, 14]);

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  };

  // hold still for a moment → blow the picture up. A finger that moves is
  // dragging the card instead, so any real movement cancels it.
  const startPress = (e: React.PointerEvent) => {
    if (picked || thrown || !option.image || imgFailed) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setZoom(true);
    }, LONG_PRESS_MS);
  };
  const movePress = (e: React.PointerEvent) => {
    const o = pressOrigin.current;
    if (!o) return;
    if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > LONG_PRESS_SLOP_PX) clearPress();
  };

  useEffect(() => clearPress, []);

  // portals need a real document; this only ever flips once, on mount
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- no cascade: fires once
  useEffect(() => setMounted(true), []);

  // Escape closes the peek (desktop)
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

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
      className={stacked ? "min-h-0 w-full max-w-sm flex-1" : "w-[46%] max-w-52"}
      style={
        stacked
          ? undefined
          : {
              rotate: `${baseRotate}deg`,
              translate: `0 ${arcDrop}px`,
              transformOrigin: "bottom center",
              marginLeft: index === 0 ? 0 : -FAN_OVERLAP_PX,
              zIndex: index + 1,
            }
      }
    >
      <motion.button
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (!thrown) onPick();
        }}
        onPointerDown={startPress}
        onPointerMove={movePress}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        disabled={!!picked}
        drag={!picked && !thrown}
        dragSnapToOrigin
        dragElastic={0.9}
        dragMomentum={false}
        style={{ x: dx }}
        onDragStart={clearPress}
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
        className={`play-card relative block w-full cursor-grab shadow-xl transition-all ${stacked ? "h-full px-4 py-2.5" : "aspect-[5/7] p-3"} ${
          state === "correct"
            ? "border-success shadow-success ring-2 ring-success"
            : state === "wrong"
              ? "border-danger"
              : state === "dim"
                ? "opacity-40"
                : ""
        }`}
      >
        {/* live tilt while dragging */}
        <motion.span style={{ rotate: dragTilt }} className="flex h-full w-full">
          {/* content box only — no border of its own: the card already is one,
              and nesting outlines turned every option into a box in a box */}
          <span
            className={`flex h-full w-full min-h-0 flex-col items-center justify-center ${
              stacked ? "gap-1" : "gap-2"
            }`}
          >
            {option.image && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
              <img
                src={option.image}
                alt=""
                draggable={false}
                onError={() => setImgFailed(true)}
                className={`pointer-events-none min-h-0 max-w-full rounded-md object-contain drop-shadow-lg ${
                  stacked ? "max-h-full" : "max-h-[70%]"
                }`}
              />
            ) : option.emoji ? (
              <span className="text-6xl">{option.emoji}</span>
            ) : option.image && imgFailed && !option.label ? (
              <ImageOff size={40} className="text-muted opacity-50" />
            ) : null}
            {option.label && (
              <span className="shrink-0 text-center text-sm font-semibold leading-tight">
                {option.label}
              </span>
            )}
          </span>
        </motion.span>

        {/* playing-card corner pips */}
        <span className="absolute left-2.5 top-2 font-display text-xs font-bold text-muted">
          {PIPS[index] ?? index + 1}
        </span>
        <span className="absolute bottom-2 right-2.5 rotate-180 font-display text-xs font-bold text-muted">
          {PIPS[index] ?? index + 1}
        </span>
      </motion.button>

      {/* Long-press peek: many pictures are only readable full-screen.
          PORTALLED to <body> on purpose — the wrapper above carries the fan
          rotation, and a transformed ancestor turns `position: fixed` into
          "fixed relative to that card", which would pin the overlay to a
          tilted 46%-wide box instead of the screen. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {zoom && option.image && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setZoom(false)}
                className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-5"
              >
                <motion.img
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  src={option.image}
                  alt=""
                  draggable={false}
                  className="max-h-[75vh] max-w-full rounded-xl bg-neutral-200 object-contain p-2"
                />
                {option.label && (
                  <span className="font-display text-lg font-bold text-white">{option.label}</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
