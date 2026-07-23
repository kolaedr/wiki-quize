/**
 * Dev/design seed: fills the DB with hand-authored countries, car brands and
 * ALL starter games — so the whole product is playable and styleable without
 * running the live Wikidata import.
 *
 *   npm run db:seed        (requires DATABASE_URL in .env)
 *
 * Every image URL is availability-checked before it enters the DB (broken →
 * dropped; brand logos pick the first working candidate). Idempotent:
 * topics/games upsert by slug, entities are replaced per topic; a later
 * admin-panel import of the same preset simply overwrites this data.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { games, limits, topicEntities, topics } from "../src/db/schema";
import { filterWorkingUrls } from "../src/lib/validate-urls";
import {
  BRANDS,
  COUNTRIES,
  MODELS,
  brandLogoUrls,
  countryArmsUrls,
  countryFlagUrl,
  countryRef,
  modelBrandRef,
} from "./seed-data";

// Same env precedence as Next.js (and scripts/migrate.ts): .env.local wins,
// so seed / migrate / the app all write to the SAME database.
config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — fill .env first (see docs/SETUP.md)");
  process.exit(1);
}
const db = drizzle(neon(url));

const PER_LEVEL = 12; // smaller levels for the seed dataset

const DEFAULT_LIMITS: Record<string, unknown> = {
  deckSizeMin: 7,
  deckSizeMax: 20,
  minTopicEntitiesChoice: 40,
  minTopicEntitiesSwipe: 30,
  minTopicEntitiesTimeline: 50,
  maxTopicEntities: 5000,
  topicsPerCreator: 3,
  gamesPerCreator: 10,
  gamesInReviewPerCreator: 3,
  importsPerCreatorPerDay: 5,
};

async function upsertTopic(slug: string, title: object, icon: string, fieldSchema: object) {
  const sourceConfig = { preset: slug, seeded: true, icon };
  const [t] = await db
    .insert(topics)
    .values({
      slug,
      title,
      sourceConfig,
      fieldSchema,
      status: "published",
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { status: "published", syncedAt: new Date(), sourceConfig },
    })
    .returning();
  return t;
}

const MIN_PUBLISHABLE_ITEMS = 8;

async function upsertGame(g: {
  slug: string;
  topicId: string;
  mechanic: "choice" | "higher_lower" | "swipe_binary";
  title: object;
  icon: string;
  config: Record<string, unknown>;
  itemCount: number;
}) {
  const config = {
    ...g.config,
    deckSize: 10,
    perLevel: PER_LEVEL,
    levels: Math.max(1, Math.ceil(g.itemCount / PER_LEVEL)),
  };
  // Too few playable items -> the game must NOT reach the catalog (it would 404)
  const status = g.itemCount >= MIN_PUBLISHABLE_ITEMS ? "published" : "unlisted";
  await db
    .insert(games)
    .values({
      slug: g.slug,
      topicId: g.topicId,
      mechanic: g.mechanic,
      config,
      style: { icon: g.icon },
      title: g.title,
      status,
    })
    .onConflictDoUpdate({
      target: games.slug,
      set: { topicId: g.topicId, status, config, style: { icon: g.icon } },
    });
  console.log(
    `  game ${g.slug} (${config.levels} levels, ${g.itemCount} items)` +
      (status === "unlisted" ? " -> UNLISTED: too few items" : ""),
  );
}

async function main() {
  console.log("Seeding limits…");
  for (const [key, value] of Object.entries(DEFAULT_LIMITS)) {
    await db
      .insert(limits)
      .values({ key, value })
      .onConflictDoUpdate({ target: limits.key, set: { value } });
  }

  // ── Validate every image URL up front ─────────────────────────
  console.log("Validating image URLs (flags, arms, logos)…");
  const flagUrls = COUNTRIES.map(countryFlagUrl);
  const armsUrls = COUNTRIES.flatMap(countryArmsUrls);
  const logoUrls = BRANDS.flatMap(brandLogoUrls);
  let ok = await filterWorkingUrls([...flagUrls, ...armsUrls, ...logoUrls]);

  // META-GUARD: flags are canonical Commons filenames. If they fail en masse,
  // the VALIDATOR is broken (rate limit / network), not the files — trust all
  // URLs rather than unlisting perfectly good games.
  const flagOkShare = flagUrls.filter((u) => ok.has(u)).length / flagUrls.length;
  if (flagOkShare < 0.6) {
    console.warn(
      `  ⚠ validation looks degraded (only ${Math.round(flagOkShare * 100)}% of canonical flags passed) — network/rate limit suspected, TRUSTING all URLs as-is`,
    );
    ok = new Set([...flagUrls, ...armsUrls, ...logoUrls]);
  }

  const brokenFlags = flagUrls.filter((u) => !ok.has(u)).length;
  const armsOkCount = COUNTRIES.filter((x) => countryArmsUrls(x).some((u) => ok.has(u))).length;
  console.log(
    `  flags: ${COUNTRIES.length - brokenFlags}/${COUNTRIES.length} ok · arms: ${armsOkCount}/${COUNTRIES.length} ok`,
  );

  // ── Countries ────────────────────────────────────────────────
  console.log("Seeding topic: countries…");
  const countriesTopic = await upsertTopic(
    "countries",
    { en: "Countries", uk: "Країни" },
    "globe",
    [
      { role: "flag", kind: "image", wikidataProp: "P41" },
      { role: "arms", kind: "image", wikidataProp: "P237" },
      { role: "languages", kind: "entityRefList", wikidataProp: "P37" },
      { role: "population", kind: "number", wikidataProp: "P1082" },
      { role: "area", kind: "number", wikidataProp: "P2046" },
    ],
  );
  await db.delete(topicEntities).where(eq(topicEntities.topicId, countriesTopic.id));
  const nC = COUNTRIES.length;
  await db.insert(topicEntities).values(
    COUNTRIES.map((x, i) => {
      const flagU = countryFlagUrl(x);
      const armsU = countryArmsUrls(x).find((u) => ok.has(u));
      return {
        topicId: countriesTopic.id,
        wikidataQid: x.qid,
        labels: { en: x.en, uk: x.uk },
        values: {
          flag: ok.has(flagU) ? flagU : undefined,
          flagEmoji: x.emoji, // content fallback if the flag image ever breaks
          arms: armsU,
          languages: x.langs,
          population: x.population,
          area: x.area,
        },
        imageUrl: ok.has(flagU) ? flagU : null,
        wikiLinks: { en: x.wikiEn, uk: x.wikiUk },
        sitelinks: 250 - i,
        difficultyScore: nC > 1 ? 1 - i / (nC - 1) : 1,
      };
    }),
  );
  const armsCount = COUNTRIES.filter((x) => countryArmsUrls(x).some((u) => ok.has(u))).length;
  console.log(`  ${nC} countries (${armsCount} with verified arms)`);

  // ── Car brands ───────────────────────────────────────────────
  console.log("Seeding topic: car-brands…");
  const brandsTopic = await upsertTopic(
    "car-brands",
    { en: "Car brands", uk: "Автомобільні бренди" },
    "car",
    [
      { role: "logo", kind: "image", wikidataProp: "P154" },
      { role: "originCountries", kind: "entityRefList", wikidataProp: "P495" },
      { role: "inception", kind: "number", wikidataProp: "P571" },
    ],
  );
  await db.delete(topicEntities).where(eq(topicEntities.topicId, brandsTopic.id));
  const nB = BRANDS.length;
  let logosOk = 0;
  const logoByBrandQid = new Map<string, string>();
  await db.insert(topicEntities).values(
    BRANDS.map((x, i) => {
      // first WORKING logo candidate — no broken logos in the game
      const logo = brandLogoUrls(x).find((u) => ok.has(u));
      if (logo) {
        logosOk++;
        logoByBrandQid.set(x.qid, logo);
      }
      return {
        topicId: brandsTopic.id,
        wikidataQid: x.qid,
        labels: { en: x.name, uk: x.name },
        values: {
          logo,
          originCountries: [countryRef(x.origin)],
          inception: x.inception,
        },
        imageUrl: logo ?? null,
        wikiLinks: { en: x.wikiEn },
        sitelinks: 200 - i,
        difficultyScore: nB > 1 ? 1 - i / (nB - 1) : 1,
      };
    }),
  );
  console.log(`  ${nB} brands (${logosOk} with verified logos)`);
  if (logosOk < nB) {
    const missing = BRANDS.filter((x) => !brandLogoUrls(x).some((u) => ok.has(u))).map(
      (x) => x.name,
    );
    console.log(`  no working logo for: ${missing.join(", ")} — excluded from logo games`);
  }

  // ── Car models (brand ↔ model, multi-level — the chief tester's game) ──
  console.log("Seeding topic: car-models…");
  const modelsTopic = await upsertTopic(
    "car-models",
    { en: "Car models", uk: "Моделі авто" },
    "car",
    [
      { role: "photo", kind: "image", wikidataProp: "P18" },
      { role: "brand", kind: "entityRefList", wikidataProp: "P176" },
      { role: "year", kind: "number", wikidataProp: "P571" },
    ],
  );
  await db.delete(topicEntities).where(eq(topicEntities.topicId, modelsTopic.id));
  const nM = MODELS.length;
  await db.insert(topicEntities).values(
    MODELS.map((x, i) => ({
      topicId: modelsTopic.id,
      wikidataQid: x.id,
      labels: { en: x.name, uk: x.name },
      values: {
        // ref carries the BRAND LOGO — images are always preferred in cards
        brand: [{ ...modelBrandRef(x), image: logoByBrandQid.get(x.brand.qid) }],
        year: x.year,
      },
      wikiLinks: { en: `https://en.wikipedia.org/wiki/${x.brand.name.replaceAll(" ", "_")}_${x.name.replaceAll(" ", "_")}` },
      sitelinks: 180 - i,
      difficultyScore: nM > 1 ? 1 - i / (nM - 1) : 1,
    })),
  );
  console.log(`  ${nM} models across ${new Set(MODELS.map((x) => x.brand.name)).size} brands`);

  // ── Games (the user's starter list + mechanic showcases) ─────
  console.log("Seeding games…");
  const ct = countriesTopic.id;
  const bt = brandsTopic.id;
  const flagsCount = COUNTRIES.filter((x) => ok.has(countryFlagUrl(x))).length;
  await upsertGame({ slug: "flags", topicId: ct, mechanic: "choice", icon: "flag", title: { en: "Flags of the World", uk: "Прапори світу" }, config: { answerRole: "flag", singleTmpl: "isFlag", emojiRole: "flagEmoji" }, itemCount: flagsCount });
  await upsertGame({ slug: "coat-of-arms", topicId: ct, mechanic: "choice", icon: "shield", title: { en: "Coats of Arms", uk: "Герби країн" }, config: { answerRole: "arms", singleTmpl: "isArms" }, itemCount: armsCount });
  await upsertGame({ slug: "country-languages", topicId: ct, mechanic: "choice", icon: "languages", title: { en: "Language & Country", uk: "Мова і країна" }, config: { refRole: "languages", singleTmpl: "langOf" }, itemCount: nC });
  await upsertGame({ slug: "car-logos", topicId: bt, mechanic: "choice", icon: "car", title: { en: "Car Logos", uk: "Логотипи авто" }, config: { answerRole: "logo", singleTmpl: "isLogo" }, itemCount: logosOk });
  await upsertGame({ slug: "car-origin", topicId: bt, mechanic: "choice", icon: "globe", title: { en: "Car Brand Origins", uk: "Звідки бренд авто" }, config: { refRole: "originCountries", promptImageRole: "logo", singleTmpl: "brandFrom" }, itemCount: nB });
  await upsertGame({ slug: "population-duel", topicId: ct, mechanic: "higher_lower", icon: "users", title: { en: "Higher: Population", uk: "Більше: населення" }, config: { valueRole: "population", tmpl: "morePopulation", imageRole: "flag" }, itemCount: nC });
  await upsertGame({ slug: "true-false-countries", topicId: ct, mechanic: "swipe_binary", icon: "scale", title: { en: "True or False: Countries", uk: "Правда чи ні: країни" }, config: { roles: [{ role: "population", tmpl: "popHigher" }, { role: "area", tmpl: "areaHigher" }] }, itemCount: nC });
  const mt = modelsTopic.id;
  await upsertGame({ slug: "car-model-brand", topicId: mt, mechanic: "choice", icon: "car", title: { en: "Model → Brand", uk: "Модель → Марка" }, config: { refRole: "brand" }, itemCount: nM });
  await upsertGame({ slug: "car-brand-model", topicId: mt, mechanic: "choice", icon: "car", title: { en: "Whose model is it?", uk: "Чия це модель?" }, config: { refRole: "brand", refDirection: "parent" }, itemCount: nM });
  await upsertGame({ slug: "car-models-age", topicId: mt, mechanic: "swipe_binary", icon: "scale", title: { en: "True or False: model age", uk: "Правда чи ні: вік моделей" }, config: { roles: [{ role: "year", tmpl: "newerThan" }] }, itemCount: nM });

  console.log("Done. Open / — the catalog should show 7 games.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
