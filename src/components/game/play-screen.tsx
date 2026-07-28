"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Square, Swords, LayoutGrid, ArrowLeft } from "lucide-react";
import type { BinaryCard, ChoiceCard } from "@/lib/deck/types";
import { useGame } from "@/stores/game";
import { useProgress } from "@/stores/progress";
import { useSettings, type ChoiceLayout } from "@/stores/settings";
import { useGameScrollLock } from "@/lib/use-scroll-lock";
import { Toaster } from "@/components/toaster";
import { GameBoard } from "./game-board";
import { GameConfigPanel } from "./game-config-panel";
import { Lives } from "./hud";
import { GameProgressBar } from "./progress-bar";
import { SwipeBinaryBoard } from "./swipe-binary-board";
import { SwipeDuelBoard } from "./swipe-duel-board";
import type { SessionResult } from "./use-game-session";

/** Icon per layout — the toggle shows the CURRENT one. */
const LAYOUT_ICON = { single: Square, duel: Swords, quad: LayoutGrid } as const;

interface Props {
  title: string;
  /** choice: layout is the user's setting; higher_lower always renders as duel; swipe_binary has its own board. */
  mechanic?: "choice" | "higher_lower" | "swipe_binary";
  duelCards?: ChoiceCard[];
  /** duel with three options — used when the player raises the card count */
  trioCards?: ChoiceCard[];
  quadCards?: ChoiceCard[];
  binaryCards?: BinaryCard[];
  /** Set for DB-backed games — finished sessions are persisted. */
  gameId?: string;
  seed?: string;
  /** Set for level-based games — passing the level unlocks the next one. */
  slug?: string;
  level?: number;
  /** total levels — used to offer "next level" on the result screen */
  levels?: number;
  /** where the back button leads (level map / catalog) */
  backHref?: string;
  /** blur radius (px) over the question image until answered; 0/undefined = off */
  promptBlur?: number;
  /** game default for the column layout (config.stackedDefault) */
  stackedDefault?: boolean;
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
  trioCards = [],
  quadCards = [],
  binaryCards = [],
  gameId,
  seed,
  slug,
  level,
  levels,
  backHref = "/",
  promptBlur,
  stackedDefault = false,
}: Props) {
  const t = useTranslations();
  const { layout, setLayout } = useSettings();
  const markCompleted = useProgress((s) => s.markCompleted);
  const recordScore = useProgress((s) => s.recordScore);
  const duelCount = useSettings((s) => s.duelCount);
  const stackedPref = useSettings((s) => s.stacked);
  const [configOpen, setConfigOpen] = useState(false);
  const setGameTitle = useGame((s) => s.setTitle);
  const resetGame = useGame((s) => s.reset);
  const lives = useGame((s) => s.lives);
  const maxLives = useGame((s) => s.maxLives);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);
  // arcade mode: no page scroll/bounce while playing
  useGameScrollLock();

  // the site header renders this as a subline under the logo, so the game
  // screen doesn't need a title row of its own
  useEffect(() => {
    setGameTitle(title);
    return () => resetGame();
  }, [title, setGameTitle, resetGame]);

  const onFinish = useCallback(
    (r: SessionResult) => {
      // survived the deck → the level is passed, next one unlocks.
      // lives left doubles as the star rating (3 = flawless run).
      if (slug && level && r.lives > 0) markCompleted(slug, level, r.lives);
      if (slug) recordScore(slug, r.score);
      if (!gameId) return; // demo decks are not persisted
      // level + stars let the server keep the same per-level rating the local
      // store keeps, so a signed-in player carries progress across devices
      fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId,
          seed,
          score: r.score,
          answers: r.answers,
          level,
          stars: r.lives,
        }),
      }).catch(() => {}); // fire-and-forget
    },
    [gameId, seed, slug, level, markCompleted, recordScore],
  );

  let active: ChoiceLayout = mounted ? layout : "duel";
  // graceful fallback if the chosen layout has no cards for this game
  if (active === "single" && binaryCards.length === 0) active = "duel";
  if (active === "duel" && duelCards.length === 0 && quadCards.length > 0) active = "quad";

  // layouts this particular game can actually render, in cycle order
  const available: ChoiceLayout[] = [];
  if (mechanic === "choice" && quadCards.length > 0) {
    if (binaryCards.length > 0) available.push("single");
    if (duelCards.length > 0) available.push("duel");
    available.push("quad");
  }
  const showLayoutSwitch = available.length > 1;


  const nextHref =
    slug && level && levels && level < levels ? `/play/${slug}/${level + 1}` : undefined;
  const nav = { nextHref, backHref, promptBlur };
  const stacked = stackedPref ?? stackedDefault;
  // three-card duel falls back to the pair when the game couldn't build a trio
  const duelDeck = duelCount === 3 && trioCards.length > 0 ? trioCards : duelCards;

  let board: React.ReactNode;
  if (mechanic === "swipe_binary" || (mechanic === "choice" && active === "single")) {
    board = <SwipeBinaryBoard key="single" cards={binaryCards} onFinish={onFinish} {...nav} />;
  } else if (mechanic === "higher_lower" || active === "duel") {
    board = (
      <SwipeDuelBoard
        key={`duel-${duelDeck === trioCards ? 3 : 2}`}
        cards={duelDeck}
        stacked={stacked}
        onFinish={onFinish}
        {...nav}
      />
    );
  } else {
    board = <GameBoard key="quad" cards={quadCards} onFinish={onFinish} {...nav} />;
  }

  return (
    <>
      {/* one slim row: back · lives · layout. Two round buttons at the edges,
          the hearts centred in the space they leave. */}
      <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-5 pt-1 pb-6">
        <Link
          href={backHref}
          aria-label={t("game.back")}
          title={t("game.back")}
          className="glass-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="flex flex-1 items-center justify-center">
          {maxLives > 0 && <Lives lives={lives} maxLives={maxLives} />}
        </span>

        {showLayoutSwitch ? (
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            aria-label={t("settings.layout")}
            aria-expanded={configOpen}
            title={t("settings.layout")}
            className={`glass-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              configOpen ? "border-accent text-accent" : "text-accent hover:text-fg"
            }`}
          >
            <LayoutIcon layout={active} />
          </button>
        ) : (
          // keeps the hearts centred when there's nothing to switch
          <span className="h-10 w-10 shrink-0" aria-hidden />
        )}
      </div>

      <GameConfigPanel
        open={configOpen && showLayoutSwitch}
        active={active}
        available={available}
        onPick={setLayout}
        stackedDefault={stackedDefault}
      />

      {board}
      <GameProgressBar />
      <Toaster />
    </>
  );
}

function LayoutIcon({ layout }: { layout: ChoiceLayout }) {
  const Icon = LAYOUT_ICON[layout];
  return <Icon size={18} />;
}
