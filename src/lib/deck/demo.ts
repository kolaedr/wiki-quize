import { SAMPLE_COUNTRIES } from "@/data/sample-countries";
import { buildChoiceDeck } from "./build";
import type { ChoiceCard } from "./types";

/** Demo decks over the bundled sample (until the DB is populated). */

export function demoQuadDeck(locale: string, seed: string): ChoiceCard[] {
  // flag image → 4 country names
  return buildChoiceDeck(SAMPLE_COUNTRIES, {
    seed: `quad-${seed}`,
    locale,
    deckSize: 10,
    optionCount: 4,
    prompt: (e) => ({
      image: e.imageUrl ?? undefined,
      emoji: (e.values.flagEmoji as string) ?? undefined,
    }),
    option: (e) => ({ label: e.labels[locale] ?? e.labels.en }),
  });
}

export function demoDuelDeck(locale: string, seed: string): ChoiceCard[] {
  // country name on top → 2 flag cards, swipe toward the right one
  return buildChoiceDeck(SAMPLE_COUNTRIES, {
    seed: `duel-${seed}`,
    locale,
    deckSize: 12,
    optionCount: 2,
    prompt: (e) => ({ label: e.labels[locale] ?? e.labels.en }),
    option: (e) => ({
      image: e.imageUrl ?? undefined,
      emoji: (e.values.flagEmoji as string) ?? undefined,
    }),
  });
}
