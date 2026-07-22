"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { ChoiceCard } from "@/lib/deck/types";

const LIVES = 3;
const FEEDBACK_MS = 1400;

interface Props {
  title: string;
  cards: ChoiceCard[];
}

/** Choice mechanic board: one-viewport, no scroll, tap options (swipe games share this shell). */
export function GameBoard({ title, cards }: Props) {
  const t = useTranslations("game");
  const [idx, setIdx] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const card = cards[idx];
  const done = over || idx >= cards.length;

  const answer = (key: string) => {
    if (picked || done) return;
    setPicked(key);
    const correct = key === card.correctKey;
    if (correct) {
      const s = streak + 1;
      setStreak(s);
      setBest(Math.max(best, s));
      setScore(score + 10 * Math.min(3, 1 + Math.floor(s / 3)));
    } else {
      setStreak(0);
      if (lives - 1 <= 0) {
        setLives(0);
        setTimeout(() => setOver(true), FEEDBACK_MS);
        return;
      }
      setLives(lives - 1);
    }
    setTimeout(() => {
      setPicked(null);
      setImgFailed(false);
      setIdx((i) => i + 1);
    }, FEEDBACK_MS);
  };

  const restart = () => {
    setIdx(0);
    setLives(LIVES);
    setStreak(0);
    setScore(0);
    setPicked(null);
    setOver(false);
    setImgFailed(false);
  };

  const hearts = useMemo(
    () =>
      Array.from({ length: LIVES }, (_, i) => (
        <span key={i} className={i < lives ? "text-danger" : "text-muted opacity-30"}>
          ♥
        </span>
      )),
    [lives],
  );

  if (done) {
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
            onClick={restart}
            className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white active:scale-95"
          >
            {t("playAgain")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4">
      {/* status bar */}
      <div className="flex items-center justify-between py-3 text-sm">
        <span className="font-display font-semibold">{title}</span>
        <div className="flex items-center gap-4">
          <span className="text-muted">
            {idx + 1}/{cards.length}
          </span>
          <span className="tracking-widest">{hearts}</span>
        </div>
      </div>

      {/* progress */}
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-accent-soft">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(idx / cards.length) * 100}%` }}
        />
      </div>

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
            {picked && card.explain.wikiUrl && (
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
          const state = !picked
            ? "idle"
            : isCorrect
              ? "correct"
              : o.key === picked
                ? "wrong"
                : "dim";
          return (
            <button
              key={o.key}
              onClick={() => answer(o.key)}
              disabled={!!picked}
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

      {/* streak */}
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
    </main>
  );
}
