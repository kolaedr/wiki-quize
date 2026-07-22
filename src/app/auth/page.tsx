"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ name: name || email.split("@")[0], email, password })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) setError(res.error.message ?? t("genericError"));
    else router.push("/");
  };

  const google = async () => {
    setError(null);
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  };

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← WikiQuize
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="glass-card w-full max-w-sm p-6">
          {/* mode switch */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-accent-soft p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-full py-2 font-medium transition-colors ${
                  mode === m ? "bg-accent text-white" : "text-muted hover:text-fg"
                }`}
              >
                {t(m)}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name")}
                autoComplete="nickname"
                className="glass-card w-full px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")}
              autoComplete="email"
              className="glass-card w-full px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="glass-card w-full px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-full bg-accent py-3 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy ? "…" : t(mode)}
            </button>
          </form>

          {googleEnabled && (
            <button
              onClick={google}
              className="glass-card mt-3 w-full py-3 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              {t("google")}
            </button>
          )}

          <p className="mt-4 text-center text-xs leading-5 text-muted">{t("why")}</p>
        </div>
      </main>
    </>
  );
}
