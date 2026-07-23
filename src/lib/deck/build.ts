import { rngFromSeed, shuffle } from "@/lib/rng";
import type { BinaryCard, BuildChoiceOptions, ChoiceCard, DeckEntity } from "./types";

/** {qid, labels, image?} reference stored inside entity values (languages, origin countries…). */
export interface EntityRef {
  qid: string;
  labels: Record<string, string | undefined>;
  /** optional visual for the ref (e.g. brand logo) — images are ALWAYS preferred in cards */
  image?: string;
}

export function refsOf(e: DeckEntity, role: string): EntityRef[] {
  const v = e.values[role];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (r): r is EntityRef => typeof r === "object" && r !== null && "qid" in r,
  );
}

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

  // Pick question entities (from the level slice when provided),
  // then order easy → hard for a difficulty ramp
  const questionPool = opts.questions?.length ? opts.questions : pool;
  const questions = shuffle(questionPool, rnd)
    .slice(0, Math.min(deckSize, questionPool.length))
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

/**
 * Relation ("ref") choice deck: the answer is a RELATED entity stored in
 * values[refRole] as [{qid, labels}] — e.g. country → its language, brand →
 * its origin country. Multi-valued rule: distractor refs must not appear
 * among ANY of the question entity's refs.
 */
export function buildRefChoiceDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    refRole: string;
    deckSize?: number;
    optionCount?: number;
    promptImageRole?: string;
    questions?: DeckEntity[];
  },
): ChoiceCard[] {
  const { seed, locale, refRole, deckSize = 10, optionCount = 4 } = opts;
  const rnd = rngFromSeed(seed);

  const pool = entities.filter((e) => refsOf(e, refRole).length > 0);
  if (pool.length < 2) return [];

  // Global ref dictionary (deduped by qid)
  const allRefs = new Map<string, EntityRef>();
  for (const e of pool) for (const r of refsOf(e, refRole)) allRefs.set(r.qid, r);

  const refLabel = (r: EntityRef) => r.labels[locale] ?? r.labels.en ?? r.qid;
  const questionPool = (opts.questions?.length ? opts.questions : pool).filter(
    (e) => refsOf(e, refRole).length > 0,
  );

  const questions = shuffle(questionPool, rnd)
    .slice(0, Math.min(deckSize, questionPool.length))
    .sort((a, b) => (b.difficultyScore ?? 0.5) - (a.difficultyScore ?? 0.5));

  const cards: ChoiceCard[] = [];
  for (const q of questions) {
    const own = refsOf(q, refRole);
    const ownQids = new Set(own.map((r) => r.qid));
    const correct = own[Math.floor(rnd() * own.length)];

    const distractors = shuffle(
      [...allRefs.values()].filter((r) => !ownQids.has(r.qid)),
      rnd,
    ).slice(0, optionCount - 1);
    if (distractors.length < optionCount - 1) continue;

    const options = shuffle(
      [correct, ...distractors].map((r) => ({
        key: r.qid,
        label: refLabel(r),
        image: r.image,
      })),
      rnd,
    );

    cards.push({
      id: `${q.qid}-${cards.length}`,
      mechanic: "choice",
      prompt: {
        label: q.labels[locale] ?? q.labels.en,
        image: opts.promptImageRole
          ? ((q.values[opts.promptImageRole] as string | undefined) ?? undefined)
          : undefined,
      },
      options,
      correctKey: correct.qid,
      explain: { wikiUrl: q.wikiLinks?.[locale] ?? q.wikiLinks?.en ?? undefined },
    });
  }
  return cards;
}

/**
 * Higher-lower deck rendered by the duel board: templated prompt
 * ("Who has the larger population?") + two entity cards; the correct one
 * has the greater numeric value. Pairs require a ≥ minGapRatio difference
 * so the answer is never debatable.
 */
export function buildHigherLowerDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    valueRole: string;
    tmpl: string;
    imageRole?: string;
    deckSize?: number;
    minGapRatio?: number;
    questions?: DeckEntity[];
  },
): ChoiceCard[] {
  const { seed, locale, valueRole, tmpl, deckSize = 10, minGapRatio = 0.15 } = opts;
  const rnd = rngFromSeed(seed);

  const val = (e: DeckEntity) => Number(e.values[valueRole]);
  const pool = entities.filter((e) => Number.isFinite(val(e)) && val(e) > 0);
  const base = (opts.questions?.length ? opts.questions : pool).filter((e) =>
    Number.isFinite(val(e)),
  );
  if (pool.length < 2) return [];

  const cards: ChoiceCard[] = [];
  const used = new Set<string>();
  const shuffled = shuffle(base, rnd);

  for (const a of shuffled) {
    if (cards.length >= deckSize) break;
    if (used.has(a.qid)) continue;
    // partner: enough gap, prefer unused, from the WHOLE pool
    const partner = shuffle(pool, rnd).find(
      (b) =>
        b.qid !== a.qid &&
        !used.has(b.qid) &&
        Math.abs(val(a) - val(b)) / Math.max(val(a), val(b)) >= minGapRatio,
    );
    if (!partner) continue;
    used.add(a.qid);
    used.add(partner.qid);

    const pair = shuffle([a, partner], rnd);
    const correct = val(pair[0]) >= val(pair[1]) ? pair[0] : pair[1];
    const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en;
    const image = (e: DeckEntity) =>
      opts.imageRole ? ((e.values[opts.imageRole] as string | undefined) ?? undefined) : undefined;

    cards.push({
      id: `${a.qid}-${partner.qid}`,
      mechanic: "choice",
      prompt: { tmpl, params: {} },
      options: pair.map((e) => ({ key: e.qid, label: label(e), image: image(e) })),
      correctKey: correct.qid,
      explain: {
        wikiUrl: correct.wikiLinks?.[locale] ?? correct.wikiLinks?.en ?? undefined,
      },
    });
  }
  return cards;
}

/**
 * True/false deck (swipe right = true, left = false). Statements compare
 * two entities on a numeric role via an i18n template; falsehoods swap the
 * pair. Gap rule keeps statements unambiguous.
 */
export function buildBinaryDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    roles: { role: string; tmpl: string }[];
    deckSize?: number;
    minGapRatio?: number;
    questions?: DeckEntity[];
  },
): BinaryCard[] {
  const { seed, locale, roles, deckSize = 10, minGapRatio = 0.15 } = opts;
  const rnd = rngFromSeed(seed);
  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en ?? e.qid;

  const cards: BinaryCard[] = [];
  const base = opts.questions?.length ? opts.questions : entities;
  const shuffledQ = shuffle(base, rnd);
  const used = new Set<string>();

  for (const a of shuffledQ) {
    if (cards.length >= deckSize) break;
    const spec = roles[Math.floor(rnd() * roles.length)];
    const val = (e: DeckEntity) => Number(e.values[spec.role]);
    if (!Number.isFinite(val(a)) || used.has(a.qid)) continue;

    const partner = shuffle(entities, rnd).find(
      (b) =>
        b.qid !== a.qid &&
        Number.isFinite(val(b)) &&
        Math.abs(val(a) - val(b)) / Math.max(val(a), val(b)) >= minGapRatio,
    );
    if (!partner) continue;
    used.add(a.qid);

    const isTrue = rnd() < 0.5;
    const [hi, lo] = val(a) >= val(partner) ? [a, partner] : [partner, a];
    // template asserts "{a} > {b}"; a truthful card puts hi first
    const [x, y] = isTrue ? [hi, lo] : [lo, hi];

    cards.push({
      id: `${a.qid}-${spec.role}-${cards.length}`,
      mechanic: "binary",
      tmpl: spec.tmpl,
      params: { a: label(x), b: label(y) },
      isTrue,
      explain: { wikiUrl: x.wikiLinks?.[locale] ?? x.wikiLinks?.en ?? undefined },
    });
  }
  return cards;
}

/**
 * SINGLE layout of a choice game (own image attribute): one card at a time —
 * statement "This is the {role} of {name}" + the image; swipe right = true,
 * left = false. Falsehoods show a difficulty-neighbor's image instead
 * (answer-key rule applies, so a "false" image is never also correct).
 */
export function buildSingleAttrDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    imageRole: string;
    tmpl: string;
    deckSize?: number;
    emojiRole?: string;
    questions?: DeckEntity[];
    answerKeys?: (e: DeckEntity) => string[];
  },
): BinaryCard[] {
  const { seed, locale, imageRole, tmpl, deckSize = 10 } = opts;
  const answerKeys = opts.answerKeys ?? ((e: DeckEntity) => [e.qid]);
  const rnd = rngFromSeed(seed);

  const img = (e: DeckEntity) => e.values[imageRole] as string | undefined;
  const pool = entities.filter((e) => img(e));
  const base = (opts.questions?.length ? opts.questions : pool).filter((e) => img(e));
  if (pool.length < 2) return [];

  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en ?? e.qid;
  const cards: BinaryCard[] = [];

  for (const q of shuffle(base, rnd).slice(0, deckSize)) {
    const isTrue = rnd() < 0.5;
    let shown = q;
    if (!isTrue) {
      const qKeys = new Set(answerKeys(q));
      const qd = q.difficultyScore ?? 0.5;
      const candidates = pool
        .filter((e) => e.qid !== q.qid && !answerKeys(e).some((k) => qKeys.has(k)))
        .sort(
          (a, b) =>
            Math.abs((a.difficultyScore ?? 0.5) - qd) -
            Math.abs((b.difficultyScore ?? 0.5) - qd),
        )
        .slice(0, 6);
      if (candidates.length === 0) continue;
      shown = candidates[Math.floor(rnd() * candidates.length)];
    }

    cards.push({
      id: `${q.qid}-${cards.length}`,
      mechanic: "binary",
      tmpl,
      params: { a: label(q) },
      image: img(shown),
      emoji: opts.emojiRole ? (shown.values[opts.emojiRole] as string | undefined) : undefined,
      isTrue,
      explain: { wikiUrl: q.wikiLinks?.[locale] ?? q.wikiLinks?.en ?? undefined },
    });
  }
  return cards;
}

/**
 * SINGLE layout of a relation game: statement "{ref} … {entity}" (e.g.
 * "Ferrari is from Italy") + optional prompt image; swipe true/false.
 * False statements pick a ref NOT belonging to the entity.
 */
export function buildSingleRefDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    refRole: string;
    tmpl: string;
    promptImageRole?: string;
    deckSize?: number;
    questions?: DeckEntity[];
  },
): BinaryCard[] {
  const { seed, locale, refRole, tmpl, deckSize = 10 } = opts;
  const rnd = rngFromSeed(seed);

  const pool = entities.filter((e) => refsOf(e, refRole).length > 0);
  if (pool.length < 2) return [];
  const allRefs = new Map<string, EntityRef>();
  for (const e of pool) for (const r of refsOf(e, refRole)) allRefs.set(r.qid, r);

  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en ?? e.qid;
  const refLabel = (r: EntityRef) => r.labels[locale] ?? r.labels.en ?? r.qid;
  const base = (opts.questions?.length ? opts.questions : pool).filter(
    (e) => refsOf(e, refRole).length > 0,
  );

  const cards: BinaryCard[] = [];
  for (const q of shuffle(base, rnd).slice(0, deckSize)) {
    const own = refsOf(q, refRole);
    const ownQids = new Set(own.map((r) => r.qid));
    const isTrue = rnd() < 0.5;
    let ref: EntityRef | undefined;
    if (isTrue) {
      ref = own[Math.floor(rnd() * own.length)];
    } else {
      const others = [...allRefs.values()].filter((r) => !ownQids.has(r.qid));
      ref = others[Math.floor(rnd() * others.length)];
    }
    if (!ref) continue;

    cards.push({
      id: `${q.qid}-${cards.length}`,
      mechanic: "binary",
      tmpl,
      params: { a: label(q), b: refLabel(ref) },
      image: opts.promptImageRole
        ? ((q.values[opts.promptImageRole] as string | undefined) ?? undefined)
        : undefined,
      isTrue,
      explain: { wikiUrl: q.wikiLinks?.[locale] ?? q.wikiLinks?.en ?? undefined },
    });
  }
  return cards;
}

/**
 * REVERSE relation deck ("Whose model is it?"): the prompt is the PARENT
 * ref (e.g. brand "Audi"), options are child entities (models) — exactly one
 * belongs to the parent. Distractors are entities NOT related to it.
 */
export function buildRefParentDeck(
  entities: DeckEntity[],
  opts: {
    seed: string;
    locale: string;
    refRole: string;
    deckSize?: number;
    optionCount?: number;
    questions?: DeckEntity[];
  },
): ChoiceCard[] {
  const { seed, locale, refRole, deckSize = 10, optionCount = 4 } = opts;
  const rnd = rngFromSeed(seed);

  const pool = entities.filter((e) => refsOf(e, refRole).length > 0);
  if (pool.length < optionCount) return [];
  const label = (e: DeckEntity) => e.labels[locale] ?? e.labels.en ?? e.qid;
  const refLabel = (r: EntityRef) => r.labels[locale] ?? r.labels.en ?? r.qid;

  // group entities by parent ref
  const groups = new Map<string, { ref: EntityRef; members: DeckEntity[] }>();
  for (const e of pool) {
    for (const r of refsOf(e, refRole)) {
      const g = groups.get(r.qid) ?? { ref: r, members: [] };
      g.members.push(e);
      groups.set(r.qid, g);
    }
  }

  // prefer questions from the level slice: parents that own sliced entities first
  const sliceQids = new Set((opts.questions ?? pool).map((e) => e.qid));
  const ordered = shuffle([...groups.values()], rnd).sort(
    (a, b) =>
      Number(b.members.some((m) => sliceQids.has(m.qid))) -
      Number(a.members.some((m) => sliceQids.has(m.qid))),
  );

  const cards: ChoiceCard[] = [];
  for (const g of ordered) {
    if (cards.length >= deckSize) break;
    const inSlice = g.members.filter((m) => sliceQids.has(m.qid));
    const memberPool = inSlice.length > 0 ? inSlice : g.members;
    const correct = memberPool[Math.floor(rnd() * memberPool.length)];

    // distractors: entities NOT belonging to this parent
    const distractors = shuffle(
      pool.filter((e) => !refsOf(e, refRole).some((r) => r.qid === g.ref.qid)),
      rnd,
    ).slice(0, optionCount - 1);
    if (distractors.length < optionCount - 1) continue;

    cards.push({
      id: `${g.ref.qid}-${cards.length}`,
      mechanic: "choice",
      prompt: { label: refLabel(g.ref), image: g.ref.image },
      options: shuffle(
        [correct, ...distractors].map((e) => ({
          key: e.qid,
          label: label(e),
          image: e.imageUrl ?? undefined,
        })),
        rnd,
      ),
      correctKey: correct.qid,
      explain: {
        wikiUrl: correct.wikiLinks?.[locale] ?? correct.wikiLinks?.en ?? undefined,
      },
    });
  }
  return cards;
}
