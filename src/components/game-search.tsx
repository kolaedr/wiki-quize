"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { resolveText } from "@/i18n/locales";
import { imageFrame } from "@/lib/image-frame";
import { searchGamesAction, type GameHit } from "@/lib/search/actions";

/** Wait this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 280;

/**
 * Typeahead for games on the home page.
 *
 * Debounced so a query goes out per PAUSE, not per keystroke, and every reply
 * is stamped with the query it answered — a slow request for "fla" must not
 * overwrite the results for "flags" when it finally lands.
 */
export function GameSearch() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();

  const [text, setText] = useState("");
  const [hits, setHits] = useState<GameHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const latest = useRef("");

  // The spinner is switched on by the KEYSTROKE, not by this effect: setting
  // state synchronously inside an effect body just to mirror an input is the
  // cascading-render pattern React warns about. The effect only owns the timer.
  const onChange = (value: string) => {
    setText(value);
    const q = value.trim();
    if (q.length < 2) {
      setHits(null);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  useEffect(() => {
    const q = text.trim();
    latest.current = q;
    if (q.length < 2) return;
    const id = setTimeout(async () => {
      const res = await searchGamesAction(q);
      if (latest.current !== q) return; // a newer query already went out
      setHits(res);
      setCursor(-1);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  // click outside closes the suggestions
  useEffect(() => {
    if (!hits) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setHits(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [hits]);

  const go = (slug: string) => {
    setHits(null);
    onChange("");
    router.push(`/play/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hits || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? hits.length - 1 : c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[cursor >= 0 ? cursor : 0].slug);
    } else if (e.key === "Escape") {
      setHits(null);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="glass-card flex items-center gap-2 px-3 py-2">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("searchGames")}
          aria-label={t("searchGames")}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted"
        />
        {loading && <Loader2 size={14} className="shrink-0 animate-spin text-muted" />}
        {!loading && text && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("searchClear")}
            className="shrink-0 text-muted transition-colors hover:text-fg"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {hits && (
        <div className="white-card absolute inset-x-0 top-full z-30 mt-2 overflow-hidden p-1 shadow-xl">
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">{t("nothingFound")}</p>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.slug}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h.slug)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  i === cursor ? "bg-accent-soft" : ""
                }`}
              >
                {h.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Commons thumb
                  <img
                    src={h.cover}
                    alt=""
                    className={`h-8 w-10 shrink-0 object-contain ${imageFrame()}`}
                  />
                ) : (
                  <GameIcon name={h.icon} size={16} className="h-8 w-10 shrink-0" />
                )}
                <span className="truncate text-sm font-medium">
                  {resolveText(h.title, locale)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
