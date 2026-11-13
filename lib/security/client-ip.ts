/**
 * Best-effort client address for rate limiting and logs.
 *
 * `X-Forwarded-For` is a plain request header: anyone connecting straight to Node can send
 * any value, and a reverse proxy usually APPENDS to what the client sent. So the header is only
 * trusted when the operator says how many proxies sit in front of the app
 * (`TRUSTED_PROXY_HOPS`, e.g. 1 for nginx/Hostinger, 2 for Cloudflare + nginx). The address
 * is then the entry that many places from the right — the one the outermost trusted proxy saw.
 * With no hops configured the header is ignored and the result is "unknown", which makes the
 * login limiter fall back to per-email counting only.
 */
export const UNKNOWN_IP = "unknown";

export function trustedProxyHops(env: Record<string, string | undefined> = process.env) {
  const n = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "0", 10);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : 0;
}

const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIpFromHeaders(headers: Headers | null | undefined, hops = trustedProxyHops()): string {
  if (!headers || hops === 0) return UNKNOWN_IP;
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return UNKNOWN_IP;
  const candidate = chain[Math.max(0, chain.length - hops)];
  return IP_SHAPE.test(candidate) ? candidate.toLowerCase() : UNKNOWN_IP;
}
