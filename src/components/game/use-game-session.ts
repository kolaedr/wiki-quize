"use client";

import { useCallback, useState } from "react";

export const FEEDBACK_MS = 1200;
const LIVES = 3;

/** Shared session state for all mechanics: lives, streak multiplier, score, advance timing. */
export function useGameSession(totalCards: number) {
  const [idx, setIdx] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const done = over || idx >= totalCards;

  const answer = useCallback(
    (key: string, correct: boolean) => {
      if (picked || done) return false;
      setPicked(key);
      let willEnd = false;
      if (correct) {
        const s = streak + 1;
        setStreak(s);
        setBest((b) => Math.max(b, s));
        setScore((v) => v + 10 * Math.min(3, 1 + Math.floor(s / 3)));
      } else {
        setStreak(0);
        willEnd = lives - 1 <= 0;
        setLives((l) => Math.max(0, l - 1));
      }
      setTimeout(() => {
        if (willEnd) setOver(true);
        else {
          setPicked(null);
          setIdx((i) => i + 1);
        }
      }, FEEDBACK_MS);
      return true;
    },
    [picked, done, streak, lives],
  );

  const restart = useCallback(() => {
    setIdx(0);
    setLives(LIVES);
    setStreak(0);
    setBest(0);
    setScore(0);
    setPicked(null);
    setOver(false);
  }, []);

  return { idx, lives, maxLives: LIVES, streak, best, score, picked, done, answer, restart };
}
