"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup";

/**
 * Kid-friendly auth: NICKNAME + password. Email is OPTIONAL (recovery /
 * parents' address). Better Auth requires an email internally, so accounts
 * without one get a synthetic `nick@users.wikiquize.app` — sign-in accepts
 * either the nickname or a real email.
 */
const SYNTH_DOMAIN = "users.wikiquize.app";
const NICK_RE = /^[a-zA-Z0-9_-]{3,20}$/;

const toEmail = (nickOrEmail: string) =>
  nickOrEmail.includes("@")
    ? nickOrEmail.trim()
    : `${nickOrEmail.trim().toLowerCase()}@${SYNTH_DOMAIN}`;

export default function AuthPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState(""); // optional on signup
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && !NICK_RE.test(nick.trim())) {
      setError(t("nickInvalid"));
      return;
    }

    setBusy(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({
            name: nick.trim(),
            email: email.trim() ? email.trim() : toEmail(nick),
            password,
          })
        : await authClient.signIn.email({ email: toEmail(nick), password });
    setBusy(false);
    if (res.error) setError(res.error.message ?? t("genericError"));
    else {
      // honor ?redirect= (e.g. an invite/challenge link that sent us to auth)
      const raw = new URLSearchParams(window.location.search).get("redirect");
      router.push(raw && raw.startsWith("/") ? raw : "/");
    }
  };

  const form = (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input
        type="text"
        required
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        placeholder={mode === "signup" ? t("nickname") : t("nickOrEmail")}
        autoComplete={mode === "signup" ? "nickname" : "username"}
      />
      <Input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("password")}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />
      {mode === "signup" && (
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailOptional")}
          autoComplete="email"
        />
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy && <Loader2 size={15} className="animate-spin" />}
        {t(mode)}
      </Button>
    </form>
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="glass-card w-full max-w-sm p-6">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(null); }}>
          <TabsList>
            <TabsTrigger value="signin">{t("signin")}</TabsTrigger>
            <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">{form}</TabsContent>
          <TabsContent value="signup">{form}</TabsContent>
        </Tabs>

        {googleEnabled && (
          <Button
            variant="glass"
            className="mt-3 w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          >
            {t("google")}
          </Button>
        )}

        <p className="mt-4 text-center text-xs leading-5 text-muted">
          {mode === "signup" ? t("whySimple") : t("why")}
        </p>
      </div>
    </main>
  );
}
