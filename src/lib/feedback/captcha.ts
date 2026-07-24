import { createHmac } from "crypto";

/**
 * Stateless micro-captcha: a tiny addition problem whose answer is verified via
 * an HMAC token — no DB row, no session. The question is visible (a real speed
 * bump, not Fort Knox); paired with a honeypot it stops naive form spam.
 */
const SECRET = process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me";
const TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 24);
}

export function newCaptcha(): { question: string; token: string } {
  const a = 1 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 8);
  const exp = Date.now() + TTL_MS;
  // the answer never leaves the server in cleartext — only its HMAC does
  const token = `${exp}.${sign(`${a + b}.${exp}`)}`;
  return { question: `${a} + ${b}`, token };
}

export function verifyCaptcha(token: string, answer: string | number): boolean {
  const [expStr, sig] = (token ?? "").split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  const a = Number(answer);
  if (!Number.isFinite(a)) return false;
  return sign(`${a}.${exp}`) === sig;
}
