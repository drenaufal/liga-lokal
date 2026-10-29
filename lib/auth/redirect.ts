/**
 * Redirect helpers shared by the proxy, the login server action and the login form.
 * Pure functions with no Node/DB imports, so they are safe in every runtime.
 */

/**
 * Request header the proxy sets (and always strips from incoming requests) on the read-only pages
 * a visitor without an account may open, so the app layout knows not to send them to /login.
 */
export const OPEN_VIEW_HEADER = "x-open-view";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/**
 * The pages a visitor without an account may read — exact shapes, never a prefix, so the pages
 * that write (`/kompetisi/baru`, `…/ubah`, `…/ku/baru`) and the Excel download stay behind login.
 * Each page still checks `GUEST_GRANTS` itself (`requireViewerCapability`).
 */
const OPEN_VIEWS = [
  /^\/kompetisi$/,
  new RegExp(`^/kompetisi/${UUID}(/jadwal)?$`, "i"),
  new RegExp(`^/kompetisi/ku/${UUID}(/(jadwal|klasemen|bagan|peserta))?$`, "i"),
  /^\/player-intelligence(\/(banding|formula|badge))?$/,
];

/**
 * The only API routes a visitor may call, both read-only:
 *   - `/api/live`: the public live feed behind the home page slider (scores and match events);
 *   - `/api/media/<id>`: images (club logos, photos) shown on the open pages. The route itself
 *     serves a visitor only rows stored as images — documents (ID, licence, receipts) need an account.
 */
const OPEN_APIS = [/^\/api\/live$/, new RegExp(`^/api/media/${UUID}$`, "i")];

export function isOpenApi(method: string, pathname: string) {
  return (method === "GET" || method === "HEAD") && OPEN_APIS.some((re) => re.test(pathname));
}

/** GET/HEAD only: a visitor's POST (a Server Function call) is never let through to these pages. */
export function isOpenView(method: string, pathname: string) {
  return (method === "GET" || method === "HEAD") && OPEN_VIEWS.some((re) => re.test(pathname));
}

/** Where each kind of account starts after signing in. */
export function landingFor(role: string | null | undefined) {
  return role === "coach" ? "/dsp" : role === "unit_bisnis" ? "/keuangan" : "/command-center";
}

const PLACEHOLDER_ORIGIN = "http://same-origin.invalid";

/**
 * Accepts a post-login target only when it is a same-origin, relative app path.
 * Returns `null` for anything else, so callers fall back to the role landing page:
 *
 *   "/kompetisi?status=live"  → ok
 *   "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/%0d%0a…" → null
 *
 * The login page itself and `/api/*` are rejected too (a `next` pointing at them would loop
 * or land on raw JSON). The fragment is dropped.
 */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  // Must be a rooted path. Browsers treat "\" like "/", so "/\evil.com" is protocol-relative.
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return null;
  // Control characters (CR/LF, tab, NUL…) and backslashes never belong in an app path.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;

  // A decoded path can still smuggle a second slash ("/%2F/evil.com" is harmless as a path,
  // but "//" after decoding is refused anyway so nothing downstream can mistake it for a host).
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return null;

  const path = url.pathname;
  if (path === "/login" || path.startsWith("/login/")) return null;
  if (path === "/api" || path.startsWith("/api/")) return null;

  return path + url.search;
}
