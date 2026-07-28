"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/lib/use-debounced";

/** Wait this long after the last keystroke before re-querying. */
const DEBOUNCE_MS = 320;

/**
 * Search box for the catalog — drives /categories?q=…
 *
 * Results update as you type. Two details make that bearable:
 *
 * - `replace`, not `push`: typing eight letters would otherwise stack eight
 *   history entries and turn Back into a spelling replay.
 * - `useTransition`, so the old results stay on screen (dimmed) while the new
 *   ones stream in instead of the list blanking on every pause.
 *
 * The Enter key still works and simply skips the wait.
 */
export function CatalogSearch({
  initial = "",
  placeholder,
}: {
  initial?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  // what the URL currently holds — guards against re-navigating to the same
  // query (mount, or coming back to the page with ?q= already set)
  const applied = useRef(initial);

  const go = (v: string) => {
    const q = v.trim();
    if (q === applied.current) return;
    applied.current = q;
    start(() => {
      router.replace(q ? `/categories?q=${encodeURIComponent(q)}` : "/categories");
    });
  };

  // one shared debounce hook instead of a local timer in every search box
  const debounced = useDebounced(text, DEBOUNCE_MS);
  useEffect(() => {
    go(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the settled value drives navigation
  }, [debounced]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(text)}
          placeholder={placeholder}
          className="h-13 pl-9"
        />
        {pending ? (
          <Loader2
            size={15}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        ) : (
          text && (
            <button
              type="button"
              onClick={() => setText("")}
              aria-label="Очистити"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
            >
              <X size={15} />
            </button>
          )
        )}
      </div>
    </div>
  );
}
