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
    slug: "transport",
    en: "Transport",
    uk: "Транспорт",
    icon: "car",
    children: [
      { slug: "cars", en: "Cars", uk: "Автомобілі", icon: "car" },
      { slug: "aircraft", en: "Aircraft", uk: "Літаки", icon: "deck" },
      { slug: "trains", en: "Trains", uk: "Потяги", icon: "deck" },
      { slug: "ships", en: "Ships", uk: "Кораблі", icon: "deck" },
    ],
  },
  {
    slug: "geography",
    en: "Geography",
    uk: "Географія",
    icon: "globe",
    children: [
      { slug: "countries", en: "Countries", uk: "Країни", icon: "flag" },
      { slug: "cities", en: "Cities", uk: "Міста", icon: "landmark" },
      { slug: "landmarks", en: "Landmarks", uk: "Визначні місця", icon: "landmark" },
    ],
  },
  {
    slug: "nature",
    en: "Nature",
    uk: "Природа",
    icon: "deck",
    children: [
      { slug: "animals", en: "Animals", uk: "Тварини", icon: "deck" },
      { slug: "plants", en: "Plants", uk: "Рослини", icon: "deck" },
    ],
  },
  {
    slug: "history",
    en: "History",
    uk: "Історія",
    icon: "scale",
    children: [
      { slug: "historical-events", en: "Historical events", uk: "Історичні події", icon: "scale" },
      { slug: "notable-people", en: "Notable people", uk: "Видатні особи", icon: "users" },
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
      { slug: "sport", en: "Sport", uk: "Спорт", icon: "users" },
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
