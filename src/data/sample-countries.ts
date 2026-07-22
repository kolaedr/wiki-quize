import type { DeckEntity } from "@/lib/deck/types";

/**
 * Bundled sample so the demo deck at /play works before the DB is populated.
 * Real games read topic_entities; this file is dev/demo-only.
 * Flag images hotlink Commons (Special:FilePath); emoji is the offline fallback.
 */
const flag = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;

const wiki = (slug: string) => ({ en: `https://en.wikipedia.org/wiki/${slug}` });

const c = (
  qid: string,
  en: string,
  file: string,
  emoji: string,
  slug: string,
  difficultyScore: number,
): DeckEntity => ({
  qid,
  labels: { en },
  values: { flagEmoji: emoji },
  imageUrl: flag(file),
  wikiLinks: wiki(slug),
  difficultyScore,
});

export const SAMPLE_COUNTRIES: DeckEntity[] = [
  c("Q142", "France", "Flag of France.svg", "🇫🇷", "France", 1.0),
  c("Q183", "Germany", "Flag of Germany.svg", "🇩🇪", "Germany", 0.98),
  c("Q212", "Ukraine", "Flag of Ukraine.svg", "🇺🇦", "Ukraine", 0.95),
  c("Q17", "Japan", "Flag of Japan.svg", "🇯🇵", "Japan", 0.93),
  c("Q155", "Brazil", "Flag of Brazil.svg", "🇧🇷", "Brazil", 0.9),
  c("Q16", "Canada", "Flag of Canada (Pantone).svg", "🇨🇦", "Canada", 0.88),
  c("Q38", "Italy", "Flag of Italy.svg", "🇮🇹", "Italy", 0.86),
  c("Q29", "Spain", "Flag of Spain.svg", "🇪🇸", "Spain", 0.84),
  c("Q34", "Sweden", "Flag of Sweden.svg", "🇸🇪", "Sweden", 0.8),
  c("Q20", "Norway", "Flag of Norway.svg", "🇳🇴", "Norway", 0.78),
  c("Q41", "Greece", "Flag of Greece.svg", "🇬🇷", "Greece", 0.76),
  c("Q45", "Portugal", "Flag of Portugal.svg", "🇵🇹", "Portugal", 0.74),
  c("Q408", "Australia", "Flag of Australia (converted).svg", "🇦🇺", "Australia", 0.72),
  c("Q96", "Mexico", "Flag of Mexico.svg", "🇲🇽", "Mexico", 0.7),
  c("Q414", "Argentina", "Flag of Argentina.svg", "🇦🇷", "Argentina", 0.66),
  c("Q79", "Egypt", "Flag of Egypt.svg", "🇪🇬", "Egypt", 0.62),
  c("Q668", "India", "Flag of India.svg", "🇮🇳", "India", 0.6),
  c("Q884", "South Korea", "Flag of South Korea.svg", "🇰🇷", "South_Korea", 0.55),
  c("Q43", "Turkey", "Flag of Turkey.svg", "🇹🇷", "Turkey", 0.5),
  c("Q36", "Poland", "Flag of Poland.svg", "🇵🇱", "Poland", 0.45),
  c("Q39", "Switzerland", "Flag of Switzerland (Pantone).svg", "🇨🇭", "Switzerland", 0.4),
  c("Q55", "Netherlands", "Flag of the Netherlands.svg", "🇳🇱", "Netherlands", 0.35),
  c("Q189", "Iceland", "Flag of Iceland.svg", "🇮🇸", "Iceland", 0.3),
  c("Q298", "Chile", "Flag of Chile.svg", "🇨🇱", "Chile", 0.25),
];
