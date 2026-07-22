import { rngFromSeed, shuffle } from "@/lib/rng";
import type { BuildChoiceOptions, ChoiceCard, DeckEntity } from "./types";

/**
 * Seeded server-side deck builder for the `choice` mechanic.
 * - deterministic: same (entities, seed, config) → same deck
 * - distractors are difficulty-neighbors of the question entity
 * - multi-valued rule: no distractor may share an answer key with the question
 */
export function buildChoiceDeck(
  entities: DeckEntity[],
  opts: BuildChoiceOptions,
): ChoiceCard[] {
  const {
    seed,
    deckSize = 10,
    optionCount = 4,
    prompt,
    option,
    answerKeys = (e) => [e.qid],
  } = opts;

  const rnd = rngFromSeed(seed);
  const pool = entities.filter((e) => e.qid);
  if (pool.length < optionCount) return [];

  // Pick question entities, then order easy → hard for a difficulty ramp
  const questions = shuffle(pool, rnd)
    .slice(0, Math.min(deckSize, pool.length))
    .sort((a, b) => (b.difficultyScore ?? 0.5) - (a.difficultyScore ?? 0.5));

  const cards: ChoiceCard[] = [];

  for (const q of questions) {
    const qKeys = new Set(answerKeys(q));

    // Candidates: everyone not sharing an answer key with the question
    const candidates = pool.filter(
      (e) => e.qid !== q.qid && !answerKeys(e).some((k) => qKeys.has(k)),
    );
    if (candidates.length < optionCount - 1) continue;

    // Prefer difficulty neighbors (plausible distractors), keep some randomness
    const qd = q.difficultyScore ?? 0.5;
    const distractors = shuffle(candidates, rnd)
      .sort(
        (a, b) =>
          Math.abs((a.difficultyScore ?? 0.5) - qd) -
          Math.abs((b.difficultyScore ?? 0.5) - qd),
      )
      .slice(0, (optionCount - 1) * 3); // neighborhood…
    const picked = shuffle(distractors, rnd).slice(0, optionCount - 1); // …random pick inside it

    const options = shuffle(
      [
        { key: q.qid, ...option(q) },
        ...picked.map((e) => ({ key: e.qid, ...option(e) })),
      ],
      rnd,
    );

    cards.push({
      id: `${q.qid}-${cards.length}`,
      mechanic: "choice",
      prompt: prompt(q),
      options,
      correctKey: q.qid,
      explain: {
        text: opts.locale ? undefined : undefined,
        wikiUrl: q.wikiLinks?.[opts.locale] ?? q.wikiLinks?.en ?? undefined,
      },
    });
  }

  return cards;
}
