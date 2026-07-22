import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as appSchema from "./schema";
import * as authSchema from "./auth-schema";

export const schema = { ...appSchema, ...authSchema };

/**
 * Lazy singleton so `next build` doesn't require DATABASE_URL.
 * Neon over HTTP — ideal for serverless route handlers.
 */
let _db: ReturnType<typeof create> | null = null;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return drizzle(neon(url), { schema });
}

export function getDb() {
  return (_db ??= create());
}

/** Convenience proxy: `db.select()…` without calling getDb() everywhere. */
export const db = new Proxy({} as ReturnType<typeof create>, {
  get(_t, prop) {
    return (getDb() as never)[prop];
  },
});
