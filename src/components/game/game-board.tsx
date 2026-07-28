"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChoiceCard, ChoiceOption } from "@/lib/deck/types";
import { blurStyle, ResultScreen, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

interface Props {
  cards: ChoiceCard[];
  onFinish?: (r: SessionResult) => void;
  nextHref?: string;
  backHref?: string;
  promptBlur?: number;
}

/** Quad layout of the `choice` mechanic: big prompt card + 2×2 tap options. */
export function GameBoard({ cards, onFinish, nextHref, backHref, promptBlur }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setImgFailed(false), [s.idx]);

  const card = cards[s.idx];
  // Picture options need a square to breathe in; text options only need a
  // couple of lines. Sizing the grid to the CONTENT keeps the question card
  // from hogging the screen when the answers are the visual part.
  const visualOptions = !!card && card.options.some((o) => o.image);
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

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-10">
      {/* card — capped when the options are pictures, so two rows of squares fit */}
      <div className={`relative min-h-0 flex-1 ${visualOptions ? "max-h-[38%]" : ""}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -24, rotate: 2 }}
            transition={{ duration: 0.22 }}
            className="play-card absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
          >
            {card.prompt.image && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
              <img
                src={card.prompt.image}
                alt=""
                onError={() => setImgFailed(true)}
                // blurred until answered, then it resolves — that reveal is the
                // point of the setting, not just a difficulty knob
                style={blurStyle(promptBlur, !!s.picked)}
                className="max-h-[64%] w-full rounded-xl object-contain drop-shadow-lg"
              />
            ) : card.prompt.emoji ? (
              <span className="text-8xl">{card.prompt.emoji}</span>
            ) : card.prompt.label ? (
              // no image → the label carries the question (never shown together
              // with an image, which would leak the answer)
              <span className="font-display text-3xl font-bold">{card.prompt.label}</span>
            ) : null}
            {s.picked && card.explain.wikiUrl && (
              <a
                href={card.explain.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline underline-offset-4"
              >
                {t("readMore")}
              </a>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* options */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {card.options.map((o) => {
          const isCorrect = o.key === card.correctKey;
          const state = !s.picked
            ? "idle"
            : isCorrect
              ? "correct"
              : o.key === s.picked
                ? "wrong"
                : "dim";
          return (
            <button
              key={o.key}
              onClick={() => s.answer(o.key, isCorrect)}
              disabled={!!s.picked}
              className={`play-card flex items-center justify-center px-3 py-3 text-center text-sm font-semibold transition-all active:scale-95 ${
                visualOptions ? "aspect-square" : "min-h-[4.5rem]"
              } ${
                state === "correct"
                  ? "border-success text-success shadow-success ring-2 ring-success"
                  : state === "wrong"
                    ? "border-danger text-danger"
                    : state === "dim"
                      ? "opacity-40"
                      : "hover:border-accent"
              }`}
            >
              <OptionContent option={o} />
            </button>
          );
        })}
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}

/**
 * An option's content: show its IMAGE when it has one (brand logo, flag, photo)
 * — that's what makes the game visual — with the label only as a small caption.
 * Falls back to text when there's no image or it fails to load.
 */
function OptionContent({ option }: { option: ChoiceOption }) {
  const [failed, setFailed] = useState(false);
  if (option.image && !failed) {
    return (
      <span className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ text fallback */}
        <img
          src={option.image}
          alt=""
          onError={() => setFailed(true)}
          className="min-h-0 max-h-full max-w-full rounded-lg object-contain"
        />
        {option.label && (
          <span className="shrink-0 text-xs font-medium text-muted">{option.label}</span>
        )}
      </span>
    );
  }
  return <span>{option.label ?? option.emoji ?? ""}</span>;
}
