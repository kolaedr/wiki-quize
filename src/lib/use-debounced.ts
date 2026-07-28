"use client";

import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * One hook instead of the timer-plus-flag dance every search box was growing.
 * Paired with TanStack Query this replaces the whole manual pattern: the
 * debounced value becomes part of the query key, so caching, deduplication and
 * out-of-order protection come for free — a stale reply can no longer overwrite
 * a newer one, because it belongs to a different key.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
