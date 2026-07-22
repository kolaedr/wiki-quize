import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Mini-catalog of demo game variants (layouts of the `choice` mechanic). */
export default async function PlayPage() {
  const t = await getTranslations();

  const modes = [
    {
      href: "/play/duel",
      emoji: "⚔️",
      title: t("game.duelTitle"),
      desc: t("game.duelDesc"),
      badge: t("game.flagship"),
    },
    {
      href: "/play/quad",
      emoji: "🎯",
      title: t("game.quadTitle"),
      desc: t("game.quadDesc"),
    },
  ];

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-4">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← {t("app.name")}
        </Link>
        <span className="glass-card px-3 py-1 text-xs text-muted">demo</span>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-4 px-5">
        <h1 className="font-display px-1 text-2xl font-bold">{t("game.chooseMode")}</h1>
        {modes.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="glass-card flex items-center gap-4 p-5 transition-all hover:border-accent active:scale-[0.98]"
          >
            <span className="text-4xl">{m.emoji}</span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 font-semibold">
                {m.title}
                {m.badge && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                    {m.badge}
                  </span>
                )}
              </span>
              <span className="text-sm text-muted">{m.desc}</span>
            </span>
          </Link>
        ))}
      </main>
    </>
  );
}
