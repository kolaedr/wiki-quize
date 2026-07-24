import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Current logged-in user (or null). Shared by social pages/actions. */
export async function getUser() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  return session?.user ?? null;
}

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A short URL-safe token for invites / challenges (22 chars, ~113 bits). */
export function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  let out = "";
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}
