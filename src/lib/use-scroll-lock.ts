"use client";

import { useEffect } from "react";

/**
 * Arcade mode: hard-lock page scroll while a game screen is mounted.
 * - overflow hidden + fixed body kills URL-bar jumps and rubber-banding
 * - touchmove preventDefault stops iOS pull-to-refresh / overscroll
 *   (motion's drag uses pointer events, so card dragging keeps working)
 */
export function useGameScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
      bodyHeight: body.style.height,
    };

    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.height = "100%";

    const prevent = (e: TouchEvent) => {
      // allow multi-touch (pinch handled by viewport) and opted-in scrollables
      if (e.touches.length > 1) return;
      if ((e.target as HTMLElement | null)?.closest?.("[data-scrollable]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.width = prev.bodyWidth;
      body.style.height = prev.bodyHeight;
      document.removeEventListener("touchmove", prevent);
    };
  }, []);
}
