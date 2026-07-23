/**
 * Apply pending SQL migrations over the SAME neon-http driver the app and the
 * seed use (HTTP, not websocket). `drizzle-kit migrate` defaults to the
 * @neondatabase/serverless websocket driver, which needs `ws` configured and
 * otherwise just hangs on the "can only connect through a websocket" warning.
 * Running the migrator over neon-http sidesteps that entirely.
 *
 *   npm run db:migrate      (requires DATABASE_URL in .env)
 *
 * Generating new migrations is still `npm run db:generate` (drizzle-kit).
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

async function main() {
  const db = drizzle(neon(url!));
  console.log("Applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations applied.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
