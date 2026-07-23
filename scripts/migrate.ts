/**
 * Apply pending SQL migrations over the SAME neon-http driver the app and the
 * seed use (HTTP, not websocket). `drizzle-kit migrate` defaults to the
 * @neondatabase/serverless websocket driver, which needs `ws` configured and
 * otherwise just hangs on the "can only connect through a websocket" warning.
 * Running the migrator over neon-http sidesteps that entirely.
 *
 *   npm run db:migrate      (requires DATABASE_URL in .env)
 *
 * It also PRINTS which database it hit and the tables that exist there, so a
 * "migration applied but I don't see the table in Neon" situation (usually a
 * wrong branch/database in the Neon console) is obvious.
 *
 * Generating new migrations is still `npm run db:generate` (drizzle-kit).
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// Match Next.js env precedence: .env.local overrides .env. Otherwise `tsx`
// (which reads only .env) could migrate a DIFFERENT database than the running
// app, so the table lands where the app can't see it.
config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

/** Show host + database name (no credentials) so you can match it to Neon. */
function describe(u: string): string {
  try {
    const p = new URL(u);
    return `${p.host}${p.pathname}`; // ep-xxx[-pooler].region.neon.tech/dbname
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  const sql = neon(url!);
  const db = drizzle(sql);

  console.log(`→ Target DB: ${describe(url!)}`);
  console.log("Applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations applied.");

  // Prove what actually exists in the DB we just wrote to.
  const tables = (await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `) as { table_name: string }[];
  console.log(`\npublic tables (${tables.length}): ${tables.map((t) => t.table_name).join(", ")}`);
  console.log(
    tables.some((t) => t.table_name === "categories")
      ? "✓ 'categories' is present in THIS database."
      : "✗ 'categories' is MISSING here — the migrator ran against a different DB than expected.",
  );

  const applied = (await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `.catch(() => [])) as { hash: string; created_at: string }[];
  console.log(`applied migrations recorded: ${applied.length}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
