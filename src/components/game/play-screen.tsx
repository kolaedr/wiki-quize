"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ChoiceCard } from "@/lib/deck/types";
import { useSettings, type ChoiceLayout } from "@/stores/settings";
import { GameBoard } from "./game-board";
import { SwipeDuelBoard } from "./swipe-duel-board";

interface Props {
  title: string;
  duelCards: ChoiceCard[];
  quadCards: ChoiceCard[];
}

/**
 * One game — several presentation layouts. The layout is a GLOBAL user
 * setting (persisted; migrates to the account after sign-in in stage 2),
 * switchable right from the game header.
 */
export function PlayScreen({ title, duelCards, quadCards }: Props) {
  const t = useTranslations();
  const { layout, setLayout } = useSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active: ChoiceLayout = mounted ? layout : "duel";

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← {t("app.name")}
        </Link>
        <div
          role="radiogroup"
          aria-label={t("settings.layout")}
          className="glass-card flex items-center gap-0.5 p-1 text-xs"
        >
          {(["duel", "quad"] as const).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={active === l}
              title={t(`settings.layout_${l}`)}
              onClick={() => setLayout(l)}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                active === l ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`}
            >
              {l === "duel" ? "⚔️" : "🎯"}
            </button>
          ))}
        </div>
      </header>
      {active === "duel" ? (
        <SwipeDuelBoard key="duel" title={title} cards={duelCards} />
      ) : (
        <GameBoard key="quad" title={title} cards={quadCards} />
      )}
    </>
  );
}
