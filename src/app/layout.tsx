import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

/**
 * Absolute base for OG/Twitter image URLs.
 *
 * Without this Next falls back to `http://localhost:3000`, which ships a dead
 * preview image to every social crawler. On Vercel,
 * `VERCEL_PROJECT_PRODUCTION_URL` is the stable production domain — preferred
 * over `VERCEL_URL`, which is unique per deployment and would make every
 * preview build advertise a different image host.
 */
function resolveSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return new URL(`https://${production}`);

  const deployment = process.env.VERCEL_URL;
  if (deployment) return new URL(`https://${deployment}`);

  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: "Lifinance — Clear the debt. Keep the life.",
  description:
    "Aggressive debt payoff planning that stays realistic about your actual daily spending. ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้",
  applicationName: "Lifinance",
  manifest: "/manifest.webmanifest",
  // iOS ignores the manifest's name and display mode; these are its equivalents.
  appleWebApp: {
    capable: true,
    title: "Lifinance",
    // "black-translucent" lets the page paint under the status bar, which is
    // what makes an installed PWA stop looking like a web page.
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // Stops iOS turning balances and account numbers into blue phone links.
    telephone: false,
  },
  openGraph: {
    title: "Lifinance — Clear the debt. Keep the life.",
    description: "ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้",
    images: ["/icons/og.png"],
    type: "website",
  },
  other: {
    // Next 15 emits only the standardised `mobile-web-app-capable`. iOS 15.4+
    // reads `display: standalone` from the manifest instead, but older iPhones
    // honour nothing except this legacy tag — one line to keep them working.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070a07" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
  ],
  width: "device-width",
  initialScale: 1,
  // Installed apps shouldn't pinch-zoom like a document…
  maximumScale: 1,
  // …but never disable zoom outright; that locks out anyone who needs it.
  userScalable: true,
  viewportFit: "cover",
};

/**
 * `suppressHydrationWarning` on <html>: the theme script below writes a class
 * before React hydrates, which is intentional — it prevents the white flash.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = JSON.parse(localStorage.getItem('lifinance.state.v1') || '{}');
                var theme = (s.settings && s.settings.theme) || 'dark';
                var lang = (s.settings && s.settings.language) || 'th';
                var dark = theme === 'dark' || (theme === 'system' &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.classList.toggle('dark', dark);
                document.documentElement.lang = lang;
                document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
