import type { MetadataRoute } from "next";

/** PWA-first is a product decision — see docs/PROJECT.md §9. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WikiQuize",
    short_name: "WikiQuize",
    description: "Fast quiz decks built from live Wikipedia data.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0913",
    theme_color: "#0a0913",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
