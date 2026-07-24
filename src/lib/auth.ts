import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as authSchema from "@/db/auth-schema";

const hasGoogle =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/**
 * Canonical site URL. Prefer BETTER_AUTH_URL; on Vercel fall back to the stable
 * production domain so a domain change doesn't 500 the login before the env var
 * is updated. Local dev → localhost.
 */
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Origins Better Auth accepts requests from (the INVALID_ORIGIN guard). Includes
 * the canonical URL, the current Vercel deployment (preview URLs), the stable
 * production domain, and localhost — deduped, empties dropped.
 */
const trustedOrigins = [
  ...new Set(
    [
      baseURL,
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
      "http://localhost:3000",
    ].filter((u): u is string => !!u),
  ),
];

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me",
  database: drizzleAdapter(getDbSafe(), {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: hasGoogle
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // never settable from the client
      },
    },
  },
});

/** During `next build` there is no DATABASE_URL — defer the failure to request time. */
function getDbSafe() {
  try {
    return getDb();
  } catch {
    return null as never;
  }
}

export type Session = typeof auth.$Infer.Session;
