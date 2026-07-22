"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Square, Swords, LayoutGrid } from "lucide-react";
import type { BinaryCard, ChoiceCard } from "@/lib/deck/types";
import { useProgress } from "@/stores/progress";
import { useSettings, type ChoiceLayout } from "@/stores/settings";
import { GameBoard } from "./game-board";
import { SwipeBinaryBoard } from "./swipe-binary-board";
import { SwipeDuelBoard } from "./swipe-duel-board";
import type { SessionResult } from "./use-game-session";

interface Props {
  title: string;
  /** choice: layout is the user's setting; higher_lower always renders as duel; swipe_binary has its own board. */
  mechanic?: "choice" | "higher_lower" | "swipe_binary";
  duelCards?: ChoiceCard[];
  quadCards?: ChoiceCard[];
  binaryCards?: BinaryCard[];
  /** Set for DB-backed games — finished sessions are persisted. */
  gameId?: string;
  seed?: string;
  /** Set for level-based games — passing the level unlocks the next one. */
  slug?: string;
  level?: number;
  backHref?: string;
}

/**
 * One game — several presentation layouts. The layout is a GLOBAL user
 * setting (persisted; migrates to the account after sign-in in stage 2),
 * switchable right from the game header.
 */
export function PlayScreen({
  title,
  mechanic = "choice",
  duelCards = [],
  quadCards = [],
  binaryCards = [],
  gameId,
  seed,
  slug,
  level,
  backHref = "/",
}: Props) {
  const t = useTranslations();
  const { layout, setLayout } = useSettings();
  const markCompleted = useProgress((s) => s.markCompleted);
  const recordScore = useProgress((s) => s.recordScore);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onFinish = useCallback(
    (r: SessionResult) => {
      // survived the deck → the level is passed, next one unlocks
      if (slug && level && r.lives > 0) markCompleted(slug, level);
      if (slug) recordScore(slug, r.score);
      if (!gameId) return; // demo decks are not persisted
      fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, seed, score: r.score, answers: r.answers }),
      }).catch(() => {}); // fire-and-forget
    },
    [gameId, seed, slug, level, markCompleted, recordScore],
  );

  let active: ChoiceLayout = mounted ? layout : "duel";
  // graceful fallback if the chosen layout has no cards for this game
  if (active === "single" && binaryCards.length === 0) active = "duel";
  if (active === "duel" && duelCards.length === 0 && quadCards.length > 0) active = "quad";

  const showLayoutSwitch = mechanic === "choice" && quadCards.length > 0;

  let board: React.ReactNode;
  if (mechanic === "swipe_binary" || (mechanic === "choice" && active === "single")) {
    board = (
      <SwipeBinaryBoard key="single" title={title} cards={binaryCards} onFinish={onFinish} />
    );
  } else if (mechanic === "higher_lower" || active === "duel") {
    board = <SwipeDuelBoard key="duel" title={title} cards={duelCards} onFinish={onFinish} />;
  } else {
    board = <GameBoard key="quad" title={title} cards={quadCards} onFinish={onFinish} />;
  }

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg"
        >
          <ChevronLeft size={16} />
          {t("app.name")}
        </Link>
        {showLayoutSwitch ? (
          <div
            role="radiogroup"
            aria-label={t("settings.layout")}
            className="glass-card flex items-center gap-0.5 p-1"
          >
            {(
              [
                ["single", Square],
                ["duel", Swords],
                ["quad", LayoutGrid],
              ] as const
            ).map(([l, Icon]) => (
              <button
                key={l}
                role="radio"
                aria-checked={active === l}
                title={t(`settings.layout_${l}`)}
                onClick={() => setLayout(l)}
                className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors ${
                  active === l ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
      </header>
      {board}
    </>
  );
}
