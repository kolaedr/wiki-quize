import { GameIcon } from "@/components/game-icon";
import { imageFrame } from "@/lib/image-frame";

/**
 * Category cover in a FIXED-height box, so a grid of cards reads as one row of
 * equal tiles no matter what the source images are.
 *
 * Covers come from Commons and have wildly different ratios (a 3:2 flag, a
 * square logo, a panoramic photo). Plain `object-cover` would crop flags and
 * logos — exactly the part that identifies them. Plain `object-contain` keeps
 * them whole but leaves big empty margins, which is what made the cards look
 * mismatched. So: a blurred, zoomed copy fills the box edge to edge, and the
 * real image sits on top, contained and never cropped.
 */
export function CategoryThumb({
  image,
  icon,
  className = "aspect-[4/3]",
}: {
  image?: string;
  icon?: string;
  /** override the box ratio/height; the fill behaviour stays the same */
  className?: string;
}) {
  return (
    <div className={`relative w-full overflow-hidden bg-accent-soft ${className}`}>
      {image ? (
        <>
          {/* decorative fill — scaled past the edges so the blur has no seam */}
          {/* eslint-disable-next-line @next/next/no-img-element -- Commons thumb */}
          <img
            src={image}
            alt=""
            aria-hidden
            className="absolute   inset-0 h-full w-full scale-125 object-cover opacity-45 blur-xl saturate-150"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- Commons thumb */}
          <img
            src={image}
            alt=""
            className={`relative h-full w-full object-contain drop-shadow-sm ${imageFrame("rounded-lg", "p-2.5")}`}
          />
        </>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-accent">
          <GameIcon name={icon} size={34} box="h-16 w-16" />
        </span>
      )}
    </div>
  );
}
