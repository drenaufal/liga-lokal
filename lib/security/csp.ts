/**
 * Content-Security-Policy, built per request by proxy.ts so scripts can be locked to a fresh nonce
 * (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md). Next.js reads the
 * nonce from the policy on the request and stamps it on its own scripts. Every page here is
 * rendered on demand (the root layout reads the locale cookie), which nonces require.
 *
 * Deliberate trade-offs:
 *  - `style-src 'unsafe-inline'`: React/Recharts emit inline `style=""` attributes that a
 *    nonce cannot cover. Inline style injection is a far smaller risk than script injection.
 *  - Remote images: the same hosts as `images.remotePatterns` in next.config.ts. Cloudinary is
 *    also allowed for XHR/uploads (api.cloudinary.com) and the hosted upload widget frame.
 *  - Fonts are self-hosted by next/font at build time, so `font-src 'self'` is enough.
 */
export const IMAGE_HOSTS = [
  "https://res.cloudinary.com",
  "https://images.unsplash.com",
  "https://api.dicebear.com",
  "https://ui-avatars.com",
] as const;

export function generateNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildCsp({ nonce, isDev = false }: { nonce: string; isDev?: boolean }) {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only (to rebuild server stack traces in the browser).
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...IMAGE_HOSTS],
    "font-src": ["'self'"],
    "connect-src": ["'self'", "https://api.cloudinary.com", "https://res.cloudinary.com", ...(isDev ? ["ws:", "wss:"] : [])],
    "media-src": ["'self'", "https://res.cloudinary.com"],
    "frame-src": ["https://upload-widget.cloudinary.com"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  if (!isDev) directives["upgrade-insecure-requests"] = [];

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}
