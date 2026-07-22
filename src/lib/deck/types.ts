import type { LocalizedText } from "@/i18n/locales";

/** Minimal entity shape the deck builder needs (subset of topic_entities row). */
export interface DeckEntity {
  qid: string;
  labels: LocalizedText;
  values: Record<string, unknown>;
  imageUrl?: string | null;
  wikiLinks?: LocalizedText | null;
  difficultyScore?: number | null;
}

export interface ChoiceOption {
  key: string;
  label?: string;
  image?: string;
  /** Offline/hotlink-failure fallback (e.g. flag emoji). */
  emoji?: string;
}

/** One playable card. `payload` shape is mechanic-specific; this is `choice`. */
export interface ChoiceCard {
  id: string;
  mechanic: "choice";
  prompt: {
    label?: string;
    image?: string;
    emoji?: string;
    /** i18n template key (rendered as game.tmpl.<key> with params) — used by higher-lower prompts. */
    tmpl?: string;
    params?: Record<string, string | number>;
  };
  options: ChoiceOption[];
  correctKey: string;
  explain: { text?: string; wikiUrl?: string };
}

/** True/false statement card: swipe right = true, left = false. */
export interface BinaryCard {
  id: string;
  mechanic: "binary";
  /** i18n template key under game.tmpl.* */
  tmpl: string;
  params: Record<string, string | number>;
  /** Optional visual (single-layout choice games show the questioned image). */
  image?: string;
  emoji?: string;
  isTrue: boolean;
  explain: { wikiUrl?: string };
}

export interface BuildChoiceOptions {
  seed: string;
  locale: string;
  deckSize?: number;
  optionCount?: number;
  /** What the player sees on the card. */
  prompt: (e: DeckEntity) => { label?: string; image?: string; emoji?: string };
  /** Option rendering for an entity used as an option. */
  option: (e: DeckEntity) => Omit<ChoiceOption, "key">;
  /**
   * Answer-identity keys (multi-valued rule, docs/PROJECT.md §2.3):
   * a distractor is DISALLOWED if it shares ANY answer key with the
   * question entity — this guarantees exactly one correct option.
   * Default: the entity itself ([qid]).
   */
  answerKeys?: (e: DeckEntity) => string[];
  /**
   * Difficulty levels: questions are drawn only from this subset
   * (e.g. level slice), while distractors may come from the full pool.
   */
  questions?: DeckEntity[];
}
