import type { MetadataRoute } from "next";

/** PWA-first is a product decision — see docs/PROJECT.md §9. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WikiQuiz",
    short_name: "WikiQuiz",
    description: "Fast quiz decks built from live Wikipedia data.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0913",
    theme_color: "#0a0913",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
