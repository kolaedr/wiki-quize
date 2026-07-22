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
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { games, limits, topicEntities, topics } from "../src/db/schema";
import { filterWorkingUrls } from "../src/lib/validate-urls";
import {
  BRANDS,
  COUNTRIES,
  brandLogoUrls,
  countryArmsUrl,
  countryFlagUrl,
  countryRef,
} from "./seed-data";

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

async function upsertTopic(slug: string, title: object, fieldSchema: object) {
  const [t] = await db
    .insert(topics)
    .values({
      slug,
      title,
      sourceConfig: { preset: slug, seeded: true },
      fieldSchema,
      status: "published",
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { status: "published", syncedAt: new Date() },
    })
    .returning();
  return t;
}

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
  await db
    .insert(games)
    .values({
      slug: g.slug,
      topicId: g.topicId,
      mechanic: g.mechanic,
      config,
      style: { icon: g.icon },
      title: g.title,
      status: "published",
    })
    .onConflictDoUpdate({
      target: games.slug,
      set: { topicId: g.topicId, status: "published", config, style: { icon: g.icon } },
    });
  console.log(`  game ${g.slug} (${config.levels} levels, ${g.itemCount} items)`);
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
  const armsUrls = COUNTRIES.map(countryArmsUrl);
  const logoUrls = BRANDS.flatMap(brandLogoUrls);
  const ok = await filterWorkingUrls([...flagUrls, ...armsUrls, ...logoUrls]);

  const brokenFlags = flagUrls.filter((u) => !ok.has(u)).length;
  const brokenArms = armsUrls.filter((u) => !ok.has(u)).length;
  console.log(
    `  flags: ${COUNTRIES.length - brokenFlags}/${COUNTRIES.length} ok · arms: ${
      COUNTRIES.length - brokenArms
    }/${COUNTRIES.length} ok`,
  );

  // ── Countries ────────────────────────────────────────────────
  console.log("Seeding topic: countries…");
  const countriesTopic = await upsertTopic(
    "countries",
    { en: "Countries", uk: "Країни" },
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
      const armsU = countryArmsUrl(x);
      return {
        topicId: countriesTopic.id,
        wikidataQid: x.qid,
        labels: { en: x.en, uk: x.uk },
        values: {
          flag: ok.has(flagU) ? flagU : undefined,
          flagEmoji: x.emoji, // content fallback if the flag image ever breaks
          arms: ok.has(armsU) ? armsU : undefined,
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
  const armsCount = COUNTRIES.filter((x) => ok.has(countryArmsUrl(x))).length;
  console.log(`  ${nC} countries (${armsCount} with verified arms)`);

  // ── Car brands ───────────────────────────────────────────────
  console.log("Seeding topic: car-brands…");
  const brandsTopic = await upsertTopic(
    "car-brands",
    { en: "Car brands", uk: "Автомобільні бренди" },
    [
      { role: "logo", kind: "image", wikidataProp: "P154" },
      { role: "originCountries", kind: "entityRefList", wikidataProp: "P495" },
      { role: "inception", kind: "number", wikidataProp: "P571" },
    ],
  );
  await db.delete(topicEntities).where(eq(topicEntities.topicId, brandsTopic.id));
  const nB = BRANDS.length;
  let logosOk = 0;
  await db.insert(topicEntities).values(
    BRANDS.map((x, i) => {
      // first WORKING logo candidate — no broken logos in the game
      const logo = brandLogoUrls(x).find((u) => ok.has(u));
      if (logo) logosOk++;
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

  console.log("Done. Open / — the catalog should show 7 games.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
