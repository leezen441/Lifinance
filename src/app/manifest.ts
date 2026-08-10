import type { MetadataRoute } from "next";

/**
 * Web app manifest — this is what turns the site into an installable app.
 *
 * Served at /manifest.webmanifest by Next's metadata route handler.
 *
 * `display: "standalone"` removes the browser chrome, so once installed it
 * looks and launches like a native app. The two icon purposes matter: Android
 * crops "maskable" into whatever shape the launcher uses (circle, squircle,
 * teardrop), while "any" is used where the icon is shown unmasked.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lifinance — Clear the debt. Keep the life.",
    short_name: "Lifinance",
    description:
      "Aggressive debt payoff planning that stays realistic about your daily spending. ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --bg in dark mode so the splash screen doesn't flash white.
    background_color: "#070a07",
    theme_color: "#070a07",
    categories: ["finance", "productivity", "lifestyle"],
    lang: "th",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the installed icon to jump straight to the two things people
    // actually open the app to do.
    shortcuts: [
      {
        name: "Log a spend · บันทึกรายจ่าย",
        short_name: "Log",
        url: "/expenses",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Debts · หนี้สิน",
        short_name: "Debts",
        url: "/debts",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
