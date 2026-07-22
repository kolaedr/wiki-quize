"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Swords, LayoutGrid } from "lucide-react";
import type { ChoiceCard } from "@/lib/deck/types";
import { useSettings, type ChoiceLayout } from "@/stores/settings";
import { GameBoard } from "./game-board";
import { SwipeDuelBoard } from "./swipe-duel-board";
import type { SessionResult } from "./use-game-session";

interface Props {
  title: string;
  duelCards: ChoiceCard[];
  quadCards: ChoiceCard[];
  /** Set for DB-backed games — finished sessions are persisted. */
  gameId?: string;
  seed?: string;
}

/**
 * One game — several presentation layouts. The layout is a GLOBAL user
 * setting (persisted; migrates to the account after sign-in in stage 2),
 * switchable right from the game header.
 */
export function PlayScreen({ title, duelCards, quadCards, gameId, seed }: Props) {
  const t = useTranslations();
  const { layout, setLayout } = useSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onFinish = useCallback(
    (r: SessionResult) => {
      if (!gameId) return; // demo decks are not persisted
      fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, seed, score: r.score, answers: r.answers }),
      }).catch(() => {}); // fire-and-forget
    },
    [gameId, seed],
  );

  const active: ChoiceLayout = mounted ? layout : "duel";

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg"
        >
          <ChevronLeft size={16} />
          {t("app.name")}
        </Link>
        <div
          role="radiogroup"
          aria-label={t("settings.layout")}
          className="glass-card flex items-center gap-0.5 p-1"
        >
          {(
            [
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
      </header>
      {active === "duel" ? (
        <SwipeDuelBoard key="duel" title={title} cards={duelCards} onFinish={onFinish} />
      ) : (
        <GameBoard key="quad" title={title} cards={quadCards} onFinish={onFinish} />
      )}
    </>
  );
}
