import type { Metadata, Viewport } from "next";
import { Anton, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { BRAND } from "@/lib/brand";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "Sistem operasi terpadu untuk manajemen kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput.",
  applicationName: BRAND.name,
  // The icon set lives in /public/Web (favicons, apple-touch-icon, PWA icons,
  // manifest). /favicon.ico and /apple-touch-icon.png also resolve — see
  // `rewrites` in next.config.ts.
  icons: {
    icon: [
      { url: "/Web/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/Web/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/Web/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/Web/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/Web/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/Web/favicon.ico",
    apple: [{ url: "/Web/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/Web/manifest.json",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  other: {
    "msapplication-TileColor": BRAND.colors.night,
    "msapplication-TileImage": "/Web/ms-icon-144x144.png",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.colors.base,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${poppins.variable} ${anton.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
