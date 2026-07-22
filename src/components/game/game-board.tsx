"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChoiceCard } from "@/lib/deck/types";
import { ResultScreen, StatusBar, StreakBadge } from "./hud";
import { useGameSession, type SessionResult } from "./use-game-session";

interface Props {
  title: string;
  cards: ChoiceCard[];
  onFinish?: (r: SessionResult) => void;
}

/** Quad layout of the `choice` mechanic: big prompt card + 2×2 tap options. */
export function GameBoard({ title, cards, onFinish }: Props) {
  const t = useTranslations("game");
  const s = useGameSession(cards.length, onFinish);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => setImgFailed(false), [s.idx]);

  const card = cards[s.idx];
  if (s.done || !card) {
    return <ResultScreen score={s.score} best={s.best} lives={s.lives} onRestart={s.restart} />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      <StatusBar title={title} idx={s.idx} total={cards.length} lives={s.lives} maxLives={s.maxLives} />

      {/* card */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -24, rotate: 2 }}
            transition={{ duration: 0.22 }}
            className="glass-card absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
          >
            {card.prompt.image && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- Commons hotlink w/ emoji fallback
              <img
                src={card.prompt.image}
                alt=""
                onError={() => setImgFailed(true)}
                className="max-h-[60%] max-w-full rounded-lg object-contain drop-shadow-lg"
              />
            ) : card.prompt.emoji ? (
              <span className="text-8xl">{card.prompt.emoji}</span>
            ) : null}
            {card.prompt.label && (
              <span className="font-display text-2xl font-bold">{card.prompt.label}</span>
            )}
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
              className={`glass-card px-3 py-4 text-sm font-semibold transition-all active:scale-95 ${
                state === "correct"
                  ? "border-success text-success shadow-glow"
                  : state === "wrong"
                    ? "border-danger text-danger"
                    : state === "dim"
                      ? "opacity-40"
                      : "hover:border-accent"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <StreakBadge streak={s.streak} />
    </main>
  );
}
