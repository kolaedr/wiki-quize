/**
 * Seed a starter tree of browse CATEGORIES with nesting, so you don't hand-make
 * the obvious public ones. Idempotent (upsert by slug). Empty categories are
 * scaffolding — they surface on the home catalog only once they have games.
 *
 *   npm run db:seed:categories
 *
 * Titles are per-locale ({en, uk}); English is the root. Assign your datasets
 * to the leaf categories (e.g. car brands/models → "cars").
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { categories } from "../src/db/schema";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — fill .env first (see docs/SETUP.md)");
  process.exit(1);
}
const db = drizzle(neon(url));

interface Node {
  slug: string;
  en: string;
  uk: string;
  icon: string;
  /** scrape helpers: Wikidata class search words + optional note */
  hints?: string[];
  note?: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    slug: "geography",
    en: "Geography",
    uk: "Географія",
    icon: "globe",
    children: [
      { slug: "countries", en: "Countries", uk: "Країни", icon: "flag", hints: ["country", "sovereign state"] },
      { slug: "capitals", en: "Capitals", uk: "Столиці", icon: "landmark", hints: ["capital city"] },
      { slug: "cities", en: "Cities", uk: "Міста", icon: "building", hints: ["city", "big city"] },
      { slug: "landmarks", en: "Landmarks", uk: "Визначні місця", icon: "landmark", hints: ["tourist attraction", "landmark"] },
      { slug: "rivers-mountains", en: "Rivers & mountains", uk: "Річки й гори", icon: "mountain", hints: ["river", "mountain"] },
    ],
  },
  {
    slug: "transport",
    en: "Transport",
    uk: "Транспорт",
    icon: "car",
    children: [
      { slug: "cars", en: "Cars", uk: "Автомобілі", icon: "car", hints: ["automobile model", "automobile manufacturer"] },
      { slug: "motorcycles", en: "Motorcycles", uk: "Мотоцикли", icon: "bike", hints: ["motorcycle model"] },
      { slug: "aircraft", en: "Aircraft", uk: "Літаки", icon: "plane", hints: ["airliner", "aircraft model"] },
      { slug: "trains", en: "Trains", uk: "Потяги", icon: "train", hints: ["locomotive class", "train"] },
      { slug: "ships", en: "Ships", uk: "Кораблі", icon: "ship", hints: ["ship class", "ship"] },
    ],
  },
  {
    slug: "military",
    en: "Military",
    uk: "Військова справа",
    icon: "shield",
    children: [
      { slug: "weapons", en: "Firearms", uk: "Стрілецька зброя", icon: "target", hints: ["firearm"] },
      { slug: "military-aircraft", en: "Military aircraft", uk: "Військова авіація", icon: "plane", hints: ["military aircraft"] },
      { slug: "military-vehicles", en: "Armored vehicles", uk: "Бронетехніка", icon: "shield", hints: ["tank", "armoured fighting vehicle"] },
      { slug: "warships", en: "Warships", uk: "Військові кораблі", icon: "anchor", hints: ["warship"] },
      { slug: "ranks-insignia", en: "Ranks & insignia", uk: "Звання та відзнаки", icon: "medal", hints: ["military rank"], note: "по країнах — опційний фільтр P17" },
      { slug: "military-symbols", en: "Military symbols", uk: "Військова символіка", icon: "flag", hints: ["military emblem", "coat of arms"] },
    ],
  },
  {
    slug: "history",
    en: "History",
    uk: "Історія",
    icon: "scale",
    children: [
      { slug: "historical-events", en: "Historical events", uk: "Історичні події", icon: "book", hints: ["historical event"] },
      { slug: "wars-battles", en: "Wars & battles", uk: "Війни та битви", icon: "swords", hints: ["battle", "war"] },
      { slug: "historical-figures", en: "Historical figures", uk: "Історичні постаті", icon: "crown", hints: ["human"], note: "Q5 завеликий — потрібен фільтр (країна P27 / професія P106)" },
      { slug: "empires", en: "States & empires", uk: "Держави та імперії", icon: "castle", hints: ["former country", "empire"] },
    ],
  },
  {
    slug: "science",
    en: "Science",
    uk: "Наука",
    icon: "atom",
    children: [
      { slug: "scientists", en: "Scientists", uk: "Науковці", icon: "microscope", hints: ["human"], note: "фільтр professia P106 = scientist" },
      { slug: "inventions", en: "Inventions", uk: "Винаходи", icon: "lightbulb", hints: ["invention"] },
      { slug: "chemical-elements", en: "Chemical elements", uk: "Хімічні елементи", icon: "flask", hints: ["chemical element"] },
      { slug: "space", en: "Space", uk: "Космос", icon: "rocket", hints: ["planet", "star", "constellation"] },
    ],
  },
  {
    slug: "nature",
    en: "Nature",
    uk: "Природа",
    icon: "leaf",
    children: [
      { slug: "animals", en: "Animals", uk: "Тварини", icon: "paw", hints: ["mammal", "species"], note: "taxon Q16521 завеликий — бери конкретні класи" },
      { slug: "birds", en: "Birds", uk: "Птахи", icon: "bird", hints: ["bird"] },
      { slug: "plants-trees", en: "Plants & trees", uk: "Рослини й дерева", icon: "tree", hints: ["plant", "tree"] },
      { slug: "fungi", en: "Fungi", uk: "Гриби", icon: "sprout", hints: ["fungus"] },
      { slug: "foods", en: "Foods", uk: "Продукти й страви", icon: "utensils", hints: ["food", "dish"] },
    ],
  },
  {
    slug: "medicine",
    en: "Medicine",
    uk: "Медицина",
    icon: "stethoscope",
    children: [
      { slug: "anatomy", en: "Anatomy", uk: "Анатомія", icon: "bone", hints: ["anatomical structure", "organ"] },
      { slug: "diseases", en: "Diseases", uk: "Хвороби", icon: "pill", hints: ["disease"] },
      { slug: "medications", en: "Medications", uk: "Ліки", icon: "syringe", hints: ["medication"] },
    ],
  },
  {
    slug: "culture",
    en: "Culture",
    uk: "Культура",
    icon: "art",
    children: [
      { slug: "movies", en: "Movies", uk: "Фільми", icon: "movie", hints: ["film"] },
      { slug: "music", en: "Music", uk: "Музика", icon: "music", hints: ["musical group", "band"] },
      { slug: "video-games", en: "Video games", uk: "Відеоігри", icon: "game", hints: ["video game"] },
      { slug: "sport", en: "Sport", uk: "Спорт", icon: "trophy", hints: ["sport", "association football club"] },
      { slug: "art", en: "Art", uk: "Мистецтво", icon: "art", hints: ["painting"] },
    ],
  },
  {
    slug: "technology",
    en: "Technology",
    uk: "Технології",
    icon: "cpu",
    children: [
      { slug: "companies", en: "Companies", uk: "Компанії", icon: "building", hints: ["business", "public company"] },
      { slug: "gadgets", en: "Gadgets", uk: "Гаджети", icon: "phone", hints: ["smartphone model", "consumer electronics"] },
      { slug: "software", en: "Software", uk: "Програмне забезпечення", icon: "cpu", hints: ["software", "programming language"] },
    ],
  },
];

async function upsert(node: Node, sortOrder: number, parentId: string | null): Promise<string> {
  const meta =
    node.hints || node.note
      ? { ...(node.hints ? { classHints: node.hints } : {}), ...(node.note ? { note: node.note } : {}) }
      : null;
  const title = { en: node.en, uk: node.uk };
  await db
    .insert(categories)
    .values({ slug: node.slug, title, icon: node.icon, meta, sortOrder, parentId })
    .onConflictDoUpdate({
      target: categories.slug,
      set: { title, icon: node.icon, meta, sortOrder, parentId },
    });
  const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, node.slug)).limit(1);
  return row!.id;
}

async function main() {
  let n = 0;
  for (const [i, parent] of TREE.entries()) {
    const pid = await upsert(parent, i, null);
    n++;
    for (const [j, child] of (parent.children ?? []).entries()) {
      await upsert(child, j, pid);
      n++;
    }
  }
  console.log(`✓ Seeded ${n} categories (${TREE.length} top-level with nesting).`);
}

main().catch((err) => {
  console.error("Category seed failed:", err);
  process.exit(1);
});
