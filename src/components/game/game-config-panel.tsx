"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Columns2, LayoutGrid, Rows3, Square, Swords } from "lucide-react";
import { Toggle, ToggleGroup } from "@/components/ui/toggle";
import { useSettings, type ChoiceLayout } from "@/stores/settings";

const LAYOUT_ICON = { single: Square, duel: Swords, quad: LayoutGrid } as const;

/**
 * In-page game settings, opened from the header toggle.
 *
 * Replaces the old tap-to-cycle button: cycling hid what the other options
 * were, so you had to click through modes to find out. A panel shows all of
 * them at once and has room for the two knobs that only make sense next to the
 * mode — how many cards, and how they're laid out.
 */
export function GameConfigPanel({
  open,
  active,
  available,
  onPick,
  /** the game's own default for column layout (config.stackedDefault) */
  stackedDefault = false,
}: {
  open: boolean;
  active: ChoiceLayout;
  available: ChoiceLayout[];
  onPick: (l: ChoiceLayout) => void;
  stackedDefault?: boolean;
}) {
  const t = useTranslations("settings");
  const duelCount = useSettings((s) => s.duelCount);
  const setDuelCount = useSettings((s) => s.setDuelCount);
  const stacked = useSettings((s) => s.stacked);
  const setStacked = useSettings((s) => s.setStacked);

  // null = "not chosen" → follow the game's default
  const isStacked = stacked ?? stackedDefault;
  // card count and column layout only apply to the duel/trio board
  const showCardOpts = active === "duel";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-5 pb-3">
            {/* row 1 — the modes, each taking an equal share */}
            <ToggleGroup
              label={t("layout")}
              size="stack"
              value={active}
              onChange={onPick}
              options={available.map((l) => {
                const Icon = LAYOUT_ICON[l];
                return { value: l, icon: <Icon size={17} />, label: t(`layoutName_${l}`) };
              })}
            />

            {/* row 2 — how many cards, and how they sit */}
            {showCardOpts && (
              <div className="flex items-stretch gap-2">
                {([2, 3] as const).map((n) => (
                  <Toggle
                    key={n}
                    pressed={duelCount === n}
                    onPressedChange={() => setDuelCount(n)}
                    className="flex-1 py-2 text-[11px]"
                  >
                    {t("cards", { count: n })}
                  </Toggle>
                ))}
                <Toggle
                  pressed={isStacked}
                  onPressedChange={setStacked}
                  title={t("stacked")}
                  className="flex-1 py-2 text-[11px]"
                >
                  {isStacked ? <Rows3 size={15} /> : <Columns2 size={15} />}
                  {t("stacked")}
                </Toggle>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
