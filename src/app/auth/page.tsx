"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const form = (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {mode === "signup" && (
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("name")}
          autoComplete="nickname"
        />
      )}
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("email")}
        autoComplete="email"
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
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy && <Loader2 size={15} className="animate-spin" />}
        {t(mode)}
      </Button>
    </form>
  );

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft size={16} />
          WikiQuize
        </Link>
      </header>

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

          <p className="mt-4 text-center text-xs leading-5 text-muted">{t("why")}</p>
        </div>
      </main>
    </>
  );
}
