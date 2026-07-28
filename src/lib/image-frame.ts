/**
 * Dark-theme plate for Commons artwork.
 *
 * Flags, logos, coats of arms and diagrams are drawn for a WHITE page — black
 * outlines on transparency — so on a dark background half of them lose their
 * outlines. They get a light plate with a little breathing room.
 *
 * LIGHT THEME GETS NOTHING: no plate, no border, no padding. The page is
 * already the background these images expect, and an earlier version that
 * framed them in both themes stacked visible outlines — card border, inner
 * border, image border — into a box-in-a-box.
 *
 * Applied to the <img> itself rather than a wrapper: with `object-contain` the
 * element box IS the frame, and every call site already carries sizing classes
 * that a new wrapper would break.
 */
export function imageFrame(radius = "rounded-lg", padding = "p-1.5"): string {
  return `${radius} dark:${padding} dark:bg-neutral-200`;
}
