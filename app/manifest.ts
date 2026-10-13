import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SabiBook",
    short_name: "SabiBook",
    description: "Talk your sales. SabiBook writes them down and keeps track of who owes you.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f0e1",
    theme_color: "#f7f0e1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
