import { getLocale, getTranslations } from "next-intl/server";
import { PlayScreen } from "@/components/game/play-screen";
import { demoDuelDeck, demoQuadDeck } from "@/lib/deck/demo";

export const dynamic = "force-dynamic"; // deck seed varies per day

/**
 * Demo game "Flags of the World". One game — the presentation layout
 * (duel pair / 4 options) is the user's global setting, not a separate game.
 */
export default async function PlayPage() {
  const locale = await getLocale();
  const t = await getTranslations();
  const seed = new Date().toISOString().slice(0, 10);

  return (
    <PlayScreen
      title={t("game.flagsTitle")}
      duelCards={demoDuelDeck(locale, seed)}
      quadCards={demoQuadDeck(locale, seed)}
    />
  );
}
