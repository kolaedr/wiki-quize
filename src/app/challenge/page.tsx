import Link from "next/link";
import { eq } from "drizzle-orm";
import { Play, Swords } from "lucide-react";
import { getLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { GameIcon } from "@/components/game-icon";
import { ExternalOpen } from "@/components/social/external-open";
import { db } from "@/db";
import { challenges, games } from "@/db/schema";
import { user } from "@/db/auth-schema";
import { resolveText } from "@/i18n/locales";

export const dynamic = "force-dynamic";

/** Challenge landing (/challenge?ch=<token>): play the same game, compare. */
export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ ch?: string }>;
}) {
  const { ch } = await searchParams;
  const token = (ch ?? "").trim();
  const locale = await getLocale();

  const shell = (children: React.ReactNode) => (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="glass-card flex w-full max-w-sm flex-col gap-4 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Swords size={24} />
        </span>
        {children}
      </div>
    </main>
  );

  if (!token) return shell(<p className="text-sm text-muted">Лінк без токена челенджа.</p>);

  const [row] = await db
    .select({
      slug: games.slug,
      title: games.title,
      style: games.style,
      author: user.name,
    })
    .from(challenges)
    .innerJoin(games, eq(games.id, challenges.gameId))
    .leftJoin(user, eq(user.id, challenges.authorId))
    .where(eq(challenges.token, token))
    .limit(1);

  if (!row)
    return shell(
      <>
        <p className="text-sm font-semibold">Челендж не знайдено</p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">На головну</Link>
        </Button>
      </>,
    );

  return shell(
    <>
      <div>
        <p className="text-sm text-muted">
          {row.author ? `${row.author} кидає тобі виклик` : "Тобі кинули виклик"}
        </p>
        <p className="flex items-center justify-center gap-2 font-display text-xl font-bold">
          <GameIcon name={(row.style as { icon?: string })?.icon} size={18} className="h-9 w-9" />
          {resolveText(row.title, locale)}
        </p>
      </div>
      <ExternalOpen storageKey="wq_pending_challenge" token={token} />
      <Button asChild size="lg">
        <Link href={`/play/${row.slug}`}>
          <Play size={16} /> Прийняти й грати
        </Link>
      </Button>
      <p className="text-[11px] text-muted">
        Зіграй той самий квіз і порівняй результат.
      </p>
    </>,
  );
}
