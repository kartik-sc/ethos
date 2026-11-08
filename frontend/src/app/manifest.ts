import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ethos",
    short_name: "Ethos",
    description: "Personal command centre",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#14171c",
    theme_color: "#14171c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tasks", url: "/tasks" },
      { name: "Habits", url: "/habits" },
      { name: "Inbox", url: "/inbox" },
    ],
  };
}
