import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Headers sent with every response. The Content-Security-Policy is NOT here: it carries a
 * per-request nonce, so it is built in proxy.ts (lib/security/csp.ts) for every page.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy twin of CSP frame-ancestors 'none' — the app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in the app needs these browser features; deny them to any injected code too.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // HTTPS only. Sent in production only so a local http://localhost is never pinned to https.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next", // TEMP: scratch dev server
  // Don't advertise the framework in an `X-Powered-By` header.
  poweredByHeader: false,
  // Dev-only badge: keep it off the floating mobile bottom nav.
  devIndicators: { position: "top-left" },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Keep in sync with IMAGE_HOSTS in lib/security/csp.ts (img-src).
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
