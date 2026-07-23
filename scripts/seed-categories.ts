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
  children?: Node[];
}

const TREE: Node[] = [
  {
    slug: "geography",
    en: "Geography",
    uk: "Географія",
    icon: "globe",
    children: [
      { slug: "countries", en: "Countries", uk: "Країни", icon: "flag" },
      { slug: "capitals", en: "Capitals", uk: "Столиці", icon: "landmark" },
      { slug: "cities", en: "Cities", uk: "Міста", icon: "landmark" },
      { slug: "landmarks", en: "Landmarks", uk: "Визначні місця", icon: "landmark" },
      { slug: "rivers-mountains", en: "Rivers & mountains", uk: "Річки й гори", icon: "globe" },
    ],
  },
  {
    slug: "transport",
    en: "Transport",
    uk: "Транспорт",
    icon: "car",
    children: [
      { slug: "cars", en: "Cars", uk: "Автомобілі", icon: "car" },
      { slug: "motorcycles", en: "Motorcycles", uk: "Мотоцикли", icon: "car" },
      { slug: "aircraft", en: "Aircraft", uk: "Літаки", icon: "deck" },
      { slug: "trains", en: "Trains", uk: "Потяги", icon: "deck" },
      { slug: "ships", en: "Ships", uk: "Кораблі", icon: "deck" },
    ],
  },
  {
    slug: "military",
    en: "Military",
    uk: "Військова справа",
    icon: "shield",
    children: [
      { slug: "weapons", en: "Firearms", uk: "Стрілецька зброя", icon: "shield" },
      { slug: "military-aircraft", en: "Military aircraft", uk: "Військова авіація", icon: "shield" },
      { slug: "military-vehicles", en: "Armored vehicles", uk: "Бронетехніка", icon: "shield" },
      { slug: "warships", en: "Warships", uk: "Військові кораблі", icon: "shield" },
      { slug: "ranks-insignia", en: "Ranks & insignia", uk: "Звання та відзнаки", icon: "shield" },
      { slug: "military-symbols", en: "Military symbols", uk: "Військова символіка", icon: "flag" },
    ],
  },
  {
    slug: "history",
    en: "History",
    uk: "Історія",
    icon: "scale",
    children: [
      { slug: "historical-events", en: "Historical events", uk: "Історичні події", icon: "scale" },
      { slug: "wars-battles", en: "Wars & battles", uk: "Війни та битви", icon: "shield" },
      { slug: "historical-figures", en: "Historical figures", uk: "Історичні постаті", icon: "users" },
      { slug: "empires", en: "States & empires", uk: "Держави та імперії", icon: "flag" },
    ],
  },
  {
    slug: "science",
    en: "Science",
    uk: "Наука",
    icon: "deck",
    children: [
      { slug: "scientists", en: "Scientists", uk: "Науковці", icon: "users" },
      { slug: "inventions", en: "Inventions", uk: "Винаходи", icon: "deck" },
      { slug: "chemical-elements", en: "Chemical elements", uk: "Хімічні елементи", icon: "deck" },
      { slug: "space", en: "Space", uk: "Космос", icon: "globe" },
    ],
  },
  {
    slug: "nature",
    en: "Nature",
    uk: "Природа",
    icon: "deck",
    children: [
      { slug: "animals", en: "Animals", uk: "Тварини", icon: "deck" },
      { slug: "birds", en: "Birds", uk: "Птахи", icon: "deck" },
      { slug: "plants-trees", en: "Plants & trees", uk: "Рослини й дерева", icon: "deck" },
      { slug: "fungi", en: "Fungi", uk: "Гриби", icon: "deck" },
      { slug: "foods", en: "Foods", uk: "Продукти й страви", icon: "deck" },
    ],
  },
  {
    slug: "medicine",
    en: "Medicine",
    uk: "Медицина",
    icon: "deck",
    children: [
      { slug: "anatomy", en: "Anatomy", uk: "Анатомія", icon: "deck" },
      { slug: "diseases", en: "Diseases", uk: "Хвороби", icon: "deck" },
      { slug: "medications", en: "Medications", uk: "Ліки", icon: "deck" },
    ],
  },
  {
    slug: "culture",
    en: "Culture",
    uk: "Культура",
    icon: "deck",
    children: [
      { slug: "movies", en: "Movies", uk: "Фільми", icon: "deck" },
      { slug: "music", en: "Music", uk: "Музика", icon: "deck" },
      { slug: "video-games", en: "Video games", uk: "Відеоігри", icon: "deck" },
      { slug: "sport", en: "Sport", uk: "Спорт", icon: "users" },
      { slug: "art", en: "Art", uk: "Мистецтво", icon: "deck" },
    ],
  },
  {
    slug: "technology",
    en: "Technology",
    uk: "Технології",
    icon: "deck",
    children: [
      { slug: "companies", en: "Companies", uk: "Компанії", icon: "deck" },
      { slug: "gadgets", en: "Gadgets", uk: "Гаджети", icon: "deck" },
      { slug: "software", en: "Software", uk: "Програмне забезпечення", icon: "deck" },
    ],
  },
];

async function upsert(node: Node, sortOrder: number, parentId: string | null): Promise<string> {
  const values = {
    slug: node.slug,
    title: { en: node.en, uk: node.uk },
    icon: node.icon,
    sortOrder,
    parentId,
  };
  await db
    .insert(categories)
    .values(values)
    .onConflictDoUpdate({
      target: categories.slug,
      set: { title: values.title, icon: node.icon, sortOrder, parentId },
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
