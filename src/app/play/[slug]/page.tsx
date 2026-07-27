import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LevelMap } from "@/components/game/level-map";
import { ChallengeButton } from "@/components/social/challenge-button";
import { resolveText } from "@/i18n/locales";
import { getAdminSession } from "@/lib/admin/guard";
import { getUser } from "@/lib/social/session";
import { getGameProgress } from "@/lib/progress/server";
import { loadGameMeta } from "@/lib/deck/from-db";

export const dynamic = "force-dynamic";

/** Level map of a DB-backed game (game-pass progression). */
export default async function GameLevelsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const me = await getUser();

  let meta;
  try {
    meta = await loadGameMeta(slug);
    // admins can preview unlisted games (e.g. thin datasets) before publishing
    if (!meta && (await getAdminSession())) meta = await loadGameMeta(slug, true);
  } catch {
    meta = null;
  }
  if (!meta) notFound();

  // account-side ratings — guests get {} and fall back to localStorage
  const serverStars = await getGameProgress(me?.id, meta.gameId);

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-5 pt-2">
        <Breadcrumbs
          items={[
            { href: `/category/${meta.topic.slug}`, label: resolveText(meta.topic.title, locale) },
            { label: resolveText(meta.title, locale) },
          ]}
        />
      </div>
      <LevelMap
        slug={meta.slug}
        title={resolveText(meta.title, locale)}
        icon={(meta.style as { icon?: string }).icon}
        cover={(meta.style as { cover?: string }).cover}
        levels={meta.config.levels}
        serverStars={serverStars}
      >
        <div className="mt-2 flex justify-center">
          <ChallengeButton gameSlug={meta.slug} />
        </div>
      </LevelMap>
    </>
  );
}
