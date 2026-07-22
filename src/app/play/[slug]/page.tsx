import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { LevelMap } from "@/components/game/level-map";
import { resolveText } from "@/i18n/locales";
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

  let meta;
  try {
    meta = await loadGameMeta(slug);
  } catch {
    meta = null;
  }
  if (!meta) notFound();

  return (
    <LevelMap
      slug={meta.slug}
      title={resolveText(meta.title, locale)}
      emoji={meta.style.emoji}
      levels={meta.config.levels}
    />
  );
}
