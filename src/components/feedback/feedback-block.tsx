"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, MessageSquarePlus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newCaptchaAction, submitFeedbackAction } from "@/lib/feedback/actions";

const KINDS = [
  { value: "topic_request", key: "kindTopic" },
  { value: "idea", key: "kindIdea" },
  { value: "bug", key: "kindBug" },
] as const;

/**
 * "I want this topic" — collapsed to a single button by default; expands to the
 * form on click (full-width button on mobile, button + hint on desktop). Guarded
 * by a stateless math captcha + a honeypot against spam.
 */
export function FeedbackBlock() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("topic_request");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [hp, setHp] = useState(""); // honeypot — stays empty for humans
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCaptcha = () => newCaptchaAction().then(setCaptcha);
  // fetch the captcha lazily — only once the form is actually opened
  useEffect(() => {
    if (open && !captcha) loadCaptcha();
  }, [open, captcha]);

  const submit = () =>
    start(async () => {
      setError(null);
      if (!captcha) return;
      const r = await submitFeedbackAction({
        kind,
        message,
        contact,
        captchaToken: captcha.token,
        captchaAnswer: answer,
        hp,
      });
      if (r.ok) {
        setDone(true);
      } else {
        setError(r.message);
        setAnswer("");
        loadCaptcha(); // rotate the question after a failed attempt
      }
    });

  // collapsed: just a button (full width on mobile, button + hint on desktop)
  if (!open) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus size={16} /> {t("want")}
        </Button>
        <span className="hidden text-sm text-muted sm:inline">{t("hint")}</span>
      </div>
    );
  }

  return (
    <section className="glass-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 font-semibold">
            <MessageSquarePlus size={18} className="text-accent" /> {t("want")}
          </h2>
          <p className="text-xs leading-5 text-muted">{t("hint")}</p>
        </div>
        {!done && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Згорнути"
            className="text-muted transition-colors hover:text-fg"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {done ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <Check size={16} /> {t("thanks")}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* kind chips */}
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  kind === k.value
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent hover:bg-accent-soft/70"
                }`}
              >
                {t(k.key)}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={1000}
            autoFocus
            placeholder={kind === "topic_request" ? t("placeholderTopic") : t("placeholderOther")}
            className="w-full resize-y rounded-xl border border-line/60 bg-transparent p-3 text-sm outline-none focus:border-accent"
          />

          <Input
            className="h-9"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("contact")}
          />

          {/* honeypot — visually hidden, must stay empty */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {/* micro-captcha + submit */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              {t("captchaQ", { q: captcha?.question ?? "…" })}
              <Input
                inputMode="numeric"
                className="h-9 w-16"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </label>
            <Button
              size="sm"
              className="ml-auto"
              disabled={pending || !message.trim() || !answer.trim() || !captcha}
              onClick={submit}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t("send")}
            </Button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
