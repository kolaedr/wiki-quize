"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { getAdminSession } from "@/lib/admin/guard";
import { getUser } from "@/lib/social/session";
import { newCaptcha, verifyCaptcha } from "./captcha";

export interface FeedbackResult {
  ok: boolean;
  message: string;
}

const KINDS = ["topic_request", "idea", "bug", "other"] as const;

/** Hand the form a fresh captcha question + signed token. */
export async function newCaptchaAction(): Promise<{ question: string; token: string }> {
  return newCaptcha();
}

/** Admin: toggle a feedback item handled/open. */
export async function setFeedbackHandledAction(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  if (!(await getAdminSession())) return { ok: false, message: "forbidden" };
  try {
    const [row] = await db
      .select({ handled: feedback.handled })
      .from(feedback)
      .where(eq(feedback.id, id))
      .limit(1);
    if (!row) return { ok: false, message: "не знайдено" };
    await db.update(feedback).set({ handled: !row.handled }).where(eq(feedback.id, id));
    revalidatePath("/admin/feedback");
    return { ok: true, message: row.handled ? "відкрито" : "позначено готовим" };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 160) };
  }
}

/** Store a feedback / "I want this topic" message (captcha + honeypot guarded). */
export async function submitFeedbackAction(input: {
  kind: string;
  message: string;
  contact?: string;
  captchaToken: string;
  captchaAnswer: string;
  hp?: string;
}): Promise<FeedbackResult> {
  // honeypot: humans never fill this hidden field — drop bots silently ("ok")
  if (input.hp && input.hp.trim()) return { ok: true, message: "Дякуємо!" };

  if (!verifyCaptcha(input.captchaToken, input.captchaAnswer))
    return { ok: false, message: "Відповідь на приклад невірна — спробуй ще раз" };

  const msg = (input.message ?? "").trim();
  if (msg.length < 2) return { ok: false, message: "Напиши, яку тему хочеш 🙂" };
  if (msg.length > 1000) return { ok: false, message: "Задовго (максимум 1000 символів)" };

  const kind = (KINDS as readonly string[]).includes(input.kind)
    ? (input.kind as (typeof KINDS)[number])
    : "topic_request";
  const contact = (input.contact ?? "").trim().slice(0, 200) || null;

  try {
    const u = await getUser();
    await db.insert(feedback).values({ kind, message: msg, contact, userId: u?.id ?? null });
    revalidatePath("/admin");
    return { ok: true, message: "Дякую! Записав — гляну, що можна спарсити наступним." };
  } catch (err) {
    const e = err as { cause?: { message?: string }; message?: string };
    const raw = (e?.cause?.message ?? e?.message ?? String(err)).trim();
    if (/does not exist/i.test(raw))
      return { ok: false, message: "Схоже, не застосовано міграцію: npm run db:migrate" };
    return { ok: false, message: raw.slice(0, 200) };
  }
}
