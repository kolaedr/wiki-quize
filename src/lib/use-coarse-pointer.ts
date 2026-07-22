"use client";

import { useEffect, useState } from "react";

/**
 * true → primary input is touch (phone/tablet): swipe gestures on.
 * false → mouse/trackpad: click + hover, no drag layer.
 * Live-updates if the device changes (e.g. convertible laptops).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}
