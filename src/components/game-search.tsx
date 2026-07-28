"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resolveText } from "@/i18n/locales";
import { imageFrame } from "@/lib/image-frame";
import { useDebounced } from "@/lib/use-debounced";
import { searchGamesAction, type GameHit } from "@/lib/search/actions";

const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;

/**
 * Typeahead for games on the home page.
 *
 * The query key is the debounced text, which does the bookkeeping the hand
 * -rolled version needed a ref and three useStates for: repeated queries come
 * from cache, in-flight duplicates are deduped, and a slow reply for "fla" can
 * no longer land on top of the results for "flags" — it belongs to a different
 * key. `keepPreviousData` holds the old list on screen while the next one
 * loads, so the dropdown doesn't blink empty between keystrokes.
 */
export function GameSearch() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();

  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = useDebounced(text.trim(), DEBOUNCE_MS);
  const enabled = q.length >= MIN_CHARS; // one letter matches nearly everything

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["games", "search", q],
    queryFn: () => searchGamesAction(q),
    enabled,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (slug: string) => {
    setOpen(false);
    setText("");
    router.push(`/play/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? hits.length - 1 : c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[cursor >= 0 ? cursor : 0].slug);
    }
  };

  const showList = open && enabled;
  const busy = enabled && isFetching;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            // opened by the KEYSTROKE, not by an effect mirroring the input
            setOpen(v.trim().length >= MIN_CHARS);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("searchGames")}
          aria-label={t("searchGames")}
          className="h-12 pl-9 pr-9"
        />
        {busy ? (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        ) : (
          text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                setOpen(false);
              }}
              aria-label={t("searchClear")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-fg"
            >
              <X size={15} />
            </button>
          )
        )}
      </div>

      {showList && (
        <Card
          variant="white"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden p-1 shadow-xl"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">{t("nothingFound")}</p>
          ) : (
            hits.map((h: GameHit, i: number) => (
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
                <span className="truncate text-sm font-medium">{resolveText(h.title, locale)}</span>
              </button>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
