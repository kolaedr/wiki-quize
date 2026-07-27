/** True when the app runs as an installed PWA (standalone display mode). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}
