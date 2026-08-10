import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Lifinance — Clear the debt. Keep the life.",
  description:
    "Aggressive debt payoff planning that stays realistic about your actual daily spending. ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้",
  applicationName: "Lifinance",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070a07" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
  ],
  width: "device-width",
  initialScale: 1,
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
