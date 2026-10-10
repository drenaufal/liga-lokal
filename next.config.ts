import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only badge: keep it off the floating mobile bottom nav.
  devIndicators: { position: "top-left" },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  typescript: {
    // Showcase build — surface type errors in the editor / `npm run typecheck`,
    // but don't hard-block the demo build on them.
    ignoreBuildErrors: true,
  },
  // The icon set lives in /public/Web. Browsers, crawlers and iOS ask for these
  // well-known names at the site root, so point them at the real files.
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/Web/favicon.ico" },
      { source: "/apple-touch-icon.png", destination: "/Web/apple-touch-icon.png" },
      { source: "/apple-touch-icon-precomposed.png", destination: "/Web/apple-touch-icon.png" },
      { source: "/manifest.json", destination: "/Web/manifest.json" },
    ];
  },
};

export default nextConfig;
