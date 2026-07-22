/**
 * Dev/design seed: fills the DB with hand-authored countries, car brands and
 * ALL starter games — so the whole product is playable and styleable without
 * running the live Wikidata import.
 *
 *   npm run db:seed        (requires DATABASE_URL in .env)
 *
 * Idempotent: topics/games upsert by slug, entities are replaced per topic.
 * A later admin-panel import of the same preset simply overwrites this data.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { games, limits, topicEntities, topics } from "../src/db/schema";
import {
  BRANDS,
  COUNTRIES,
  brandLogoUrl,
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
  emoji: string;
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
      style: { emoji: g.emoji },
      title: g.title,
      status: "published",
    })
    .onConflictDoUpdate({
      target: games.slug,
      set: { topicId: g.topicId, status: "published", config },
    });
  console.log(`  game ${g.slug} (${config.levels} levels)`);
}

async function main() {
  console.log("Seeding limits…");
  for (const [key, value] of Object.entries(DEFAULT_LIMITS)) {
    await db
      .insert(limits)
      .values({ key, value })
      .onConflictDoUpdate({ target: limits.key, set: { value } });
  }

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
    COUNTRIES.map((x, i) => ({
      topicId: countriesTopic.id,
      wikidataQid: x.qid,
      labels: { en: x.en, uk: x.uk },
      values: {
        flag: countryFlagUrl(x),
        flagEmoji: x.emoji,
        arms: countryArmsUrl(x),
        languages: x.langs,
        population: x.population,
        area: x.area,
      },
      imageUrl: countryFlagUrl(x),
      wikiLinks: { en: x.wikiEn, uk: x.wikiUk },
      sitelinks: 250 - i,
      difficultyScore: nC > 1 ? 1 - i / (nC - 1) : 1,
    })),
  );
  console.log(`  ${nC} countries`);

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
  await db.insert(topicEntities).values(
    BRANDS.map((x, i) => ({
      topicId: brandsTopic.id,
      wikidataQid: x.qid,
      labels: { en: x.name, uk: x.name },
      values: {
        logo: brandLogoUrl(x),
        originCountries: [countryRef(x.origin)],
        inception: x.inception,
      },
      imageUrl: brandLogoUrl(x),
      wikiLinks: { en: x.wikiEn },
      sitelinks: 200 - i,
      difficultyScore: nB > 1 ? 1 - i / (nB - 1) : 1,
    })),
  );
  console.log(`  ${nB} brands`);

  // ── Games (the user's starter list + mechanic showcases) ─────
  console.log("Seeding games…");
  const ct = countriesTopic.id;
  const bt = brandsTopic.id;
  await upsertGame({ slug: "flags", topicId: ct, mechanic: "choice", emoji: "🚩", title: { en: "Flags of the World", uk: "Прапори світу" }, config: { answerRole: "flag" }, itemCount: nC });
  await upsertGame({ slug: "coat-of-arms", topicId: ct, mechanic: "choice", emoji: "🛡️", title: { en: "Coats of Arms", uk: "Герби країн" }, config: { answerRole: "arms" }, itemCount: nC });
  await upsertGame({ slug: "country-languages", topicId: ct, mechanic: "choice", emoji: "💬", title: { en: "Language & Country", uk: "Мова і країна" }, config: { refRole: "languages" }, itemCount: nC });
  await upsertGame({ slug: "car-logos", topicId: bt, mechanic: "choice", emoji: "🚗", title: { en: "Car Logos", uk: "Логотипи авто" }, config: { answerRole: "logo" }, itemCount: nB });
  await upsertGame({ slug: "car-origin", topicId: bt, mechanic: "choice", emoji: "🌍", title: { en: "Car Brand Origins", uk: "Звідки бренд авто" }, config: { refRole: "originCountries", promptImageRole: "logo" }, itemCount: nB });
  await upsertGame({ slug: "population-duel", topicId: ct, mechanic: "higher_lower", emoji: "👥", title: { en: "Higher: Population", uk: "Більше: населення" }, config: { valueRole: "population", tmpl: "morePopulation", imageRole: "flag" }, itemCount: nC });
  await upsertGame({ slug: "true-false-countries", topicId: ct, mechanic: "swipe_binary", emoji: "⚖️", title: { en: "True or False: Countries", uk: "Правда чи ні: країни" }, config: { roles: [{ role: "population", tmpl: "popHigher" }, { role: "area", tmpl: "areaHigher" }] }, itemCount: nC });

  console.log("Done. Open / — the catalog should show 7 games.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
