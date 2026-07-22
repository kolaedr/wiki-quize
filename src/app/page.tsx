import Link from "next/link";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  const t = useTranslations();

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <span className="font-display text-lg font-semibold tracking-tight">
          {t("app.name")}
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-display max-w-xs bg-gradient-to-br from-fg via-fg to-accent bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent">
            {t("app.tagline")}
          </h1>
          <p className="max-w-sm text-balance text-sm leading-6 text-muted">
            {t("app.description")}
          </p>
        </div>

        {/* Card-stack teaser: a hint of the swipe mechanic to come */}
        <div className="relative h-44 w-72" aria-hidden>
          <div className="glass-card absolute inset-0 -rotate-6 translate-y-3 opacity-40" />
          <div className="glass-card absolute inset-0 rotate-3 translate-y-1.5 opacity-70" />
          <div className="glass-card shadow-glow absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🌍</span>
          </div>
        </div>

        <Link
          href="/play"
          className="shadow-glow rounded-full bg-accent px-8 py-4 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          {t("home.tryDemo")}
        </Link>
      </main>
    </>
  );
}
