/**
 * Security checks that need no database: the `next` redirect filter, the login brute-force limiter,
 * trusted-proxy address parsing, the CSP, the production env check, the seed guards, the proxy
 * matcher, and a static scan that no browser-bound file can import the demo credentials.
 * Run with `npm run test:security`.
 */
import fs from "node:fs";
import path from "node:path";
import { landingFor, safeNextPath } from "@/lib/auth/redirect";
import { BCRYPT_COST, hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { FailureLimiter } from "@/lib/security/rate-limit";
import { LOGIN_LIMITS, LOGIN_WINDOW_MS, createLoginGuard } from "@/lib/security/login-guard";
import { UNKNOWN_IP, clientIpFromHeaders, trustedProxyHops } from "@/lib/security/client-ip";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { isSameOrigin } from "@/lib/security/same-origin";
import { authSecretProblem, productionEnvProblems } from "@/lib/env";
import { demoSeedBlocker, isLocalDatabase, wipeBlocker } from "@/lib/db/seed-guard";
import { hashSync } from "bcryptjs";

let failures = 0;
function ok(cond: boolean, label: string) {
  if (!cond) failures++;
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
}
const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

/* ── safeNextPath: only same-origin relative paths survive ─────────────────── */
ok(safeNextPath("/kompetisi") === "/kompetisi", "plain app path is kept");
ok(safeNextPath("/kompetisi?status=live&q=a%20b") === "/kompetisi?status=live&q=a%20b", "query string is kept");
ok(safeNextPath("/registry/pemain/abc#frag") === "/registry/pemain/abc", "fragment is dropped");
for (const bad of [
  "//evil.com", "//evil.com/x", "/\\evil.com", "/\\/evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)",
  "evil.com", "", "  /x", "/ok\r\nSet-Cookie: a=b", "/ok\u0000", "/a\\b", "/%2f/evil.com/..", "/login", "/login?next=/x", "/api/auth/signout", "/api/media/1",
]) {
  ok(safeNextPath(bad) === null, `rejects ${JSON.stringify(bad)}`);
}
ok(safeNextPath(null) === null && safeNextPath(undefined) === null && safeNextPath(42) === null, "rejects non-strings");
ok(safeNextPath("/" + "a".repeat(3000)) === null, "rejects absurdly long paths");
ok(landingFor("coach") === "/dsp" && landingFor("unit_bisnis") === "/keuangan" && landingFor("admin") === "/command-center" && landingFor(undefined) === "/command-center", "landing page follows the role");

/* ── limiter + login guard (fake clock) ────────────────────────────────────── */
{
  let now = 1_000_000;
  const lim = new FailureLimiter({ limit: 3, windowMs: 60_000, maxKeys: 4 }, () => now);
  lim.hit("a"); lim.hit("a");
  ok(lim.blockedFor("a") === 0, "below the limit is not blocked");
  lim.hit("a");
  ok(lim.blockedFor("a") === 60, "blocked at the limit, with seconds remaining");
  now += 30_000;
  ok(lim.blockedFor("a") === 30, "retry-after counts down");
  now += 31_000;
  ok(lim.blockedFor("a") === 0, "block lifts when the window ends");
  for (const k of ["k1", "k2", "k3", "k4", "k5", "k6"]) lim.hit(k);
  ok(lim.size <= 4, "memory stays bounded (maxKeys)");
}
{
  let now = 5_000_000;
  const guard = createLoginGuard(() => now);
  const mail = "Victim@Example.com";
  for (let i = 0; i < LOGIN_LIMITS.pair - 1; i++) guard.failure("1.1.1.1", mail);
  ok(guard.check("1.1.1.1", mail).allowed, "still allowed before the 5th failure");
  guard.failure("1.1.1.1", mail);
  const blocked = guard.check("1.1.1.1", " victim@example.com ");
  ok(!blocked.allowed && blocked.retryAfterSec > 0 && blocked.retryAfterSec <= LOGIN_WINDOW_MS / 1000, "5 failures block that source+email (email is case/space-insensitive)");
  ok(guard.check("2.2.2.2", mail).allowed, "another source can still sign in to that account");
  ok(guard.check("1.1.1.1", "someone.else@example.com").allowed, "the same source is not blocked for a different account");
  guard.failure("9.9.9.9", "ghost@example.com");
  ok(guard.check("9.9.9.9", "ghost@example.com").allowed, "an unknown email is allowed its first attempts like a known one");
  for (let i = 0; i < LOGIN_LIMITS.pair - 1; i++) guard.failure("9.9.9.9", "ghost@example.com");
  ok(!guard.check("9.9.9.9", "ghost@example.com").allowed, "…and is blocked after the same number of failures (no enumeration)");
  for (let i = 0; i < LOGIN_LIMITS.ip; i++) guard.failure("3.3.3.3", `user${i}@example.com`);
  ok(!guard.check("3.3.3.3", "fresh@example.com").allowed, "one source spraying many emails is blocked per source");
  for (let i = 0; i < LOGIN_LIMITS.email; i++) guard.failure(`10.0.0.${i % 250}`, "target@example.com");
  ok(!guard.check("10.9.9.9", "target@example.com").allowed, "a distributed attack on one email hits the per-email cap");
  guard.success("1.1.1.1", mail);
  ok(guard.check("1.1.1.1", mail).allowed, "a successful sign-in clears the source+email counter");
  now += LOGIN_WINDOW_MS + 1000;
  ok(guard.check("3.3.3.3", "fresh@example.com").allowed, "counters expire after the window");
  for (let i = 0; i < LOGIN_LIMITS.pair; i++) guard.failure(UNKNOWN_IP, "a@example.com");
  ok(!guard.check(UNKNOWN_IP, "a@example.com").allowed && guard.check(UNKNOWN_IP, "b@example.com").allowed, "with no client address, counting falls back to per email");
}

/* ── trusted-proxy client address ──────────────────────────────────────────── */
{
  const h = (xff: string) => new Headers({ "x-forwarded-for": xff });
  ok(trustedProxyHops({}) === 0 && trustedProxyHops({ TRUSTED_PROXY_HOPS: "1" }) === 1 && trustedProxyHops({ TRUSTED_PROXY_HOPS: "abc" }) === 0 && trustedProxyHops({ TRUSTED_PROXY_HOPS: "99" }) === 0, "TRUSTED_PROXY_HOPS parsing");
  ok(clientIpFromHeaders(h("6.6.6.6, 7.7.7.7"), 0) === UNKNOWN_IP, "X-Forwarded-For is ignored when no proxy is trusted");
    ok(clientIpFromHeaders(h("5.5.5.5, 7.7.7.7"), 1) === "7.7.7.7", "one trusted proxy → the rightmost entry");
  ok(clientIpFromHeaders(h("6.6.6.6, 7.7.7.7, 8.8.8.8"), 2) === "7.7.7.7", "two trusted proxies → second from the right (a spoofed left entry is ignored)");
  ok(clientIpFromHeaders(h("not an ip"), 1) === UNKNOWN_IP && clientIpFromHeaders(new Headers(), 1) === UNKNOWN_IP && clientIpFromHeaders(null, 1) === UNKNOWN_IP, "garbage / missing header → unknown");
}

/* ── passwords ────────────────────────────────────────────────────────────── */
async function passwordChecks() {
  ok(BCRYPT_COST >= 12, "bcrypt cost is at least 12");
  const hash = await hashPassword("correct horse battery staple");
  ok(hash.startsWith(`$2b$${BCRYPT_COST}$`) || hash.startsWith(`$2a$${BCRYPT_COST}$`), "new hashes use the policy cost");
  ok(await verifyPassword("correct horse battery staple", hash), "right password verifies");
  ok(!(await verifyPassword("wrong", hash)), "wrong password fails");
  ok(!(await verifyPassword("anything", null)) && !(await verifyPassword("anything", undefined)), "no stored hash never verifies (unknown email path)");
  ok(!needsRehash(hash) && needsRehash(hashSync("x", 10)) && !needsRehash("not-a-hash"), "older, cheaper hashes are flagged for upgrade");
}

/* ── CSP ──────────────────────────────────────────────────────────────────── */
{
  const nonce = generateNonce();
  ok(/^[A-Za-z0-9+/]{22}==$/.test(nonce) && nonce !== generateNonce(), "nonce is 128 random bits, fresh each call");
  const prod = buildCsp({ nonce });
  const dev = buildCsp({ nonce, isDev: true });
  const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " ")) ?? "";
  ok(directive(prod, "script-src").includes(`'nonce-${nonce}'`) && directive(prod, "script-src").includes("'strict-dynamic'"), "scripts are locked to the nonce");
  ok(!directive(prod, "script-src").includes("'unsafe-inline'") && !directive(prod, "script-src").includes("'unsafe-eval'"), "production script-src has no unsafe-inline / unsafe-eval");
  ok(directive(dev, "script-src").includes("'unsafe-eval'") && directive(dev, "connect-src").includes("ws:"), "development adds eval + websocket for hot reload only");
  ok(directive(prod, "img-src").includes("https://res.cloudinary.com") && directive(prod, "connect-src").includes("https://api.cloudinary.com"), "Cloudinary images and uploads stay allowed");
  ok(directive(prod, "font-src") === "font-src 'self'", "fonts are self-hosted (next/font)");
  ok(directive(prod, "frame-ancestors") === "frame-ancestors 'none'" && directive(prod, "object-src") === "object-src 'none'" && directive(prod, "base-uri") === "base-uri 'self'" && directive(prod, "form-action") === "form-action 'self'", "frame-ancestors / object-src / base-uri / form-action are locked down");
  ok(prod.split("; ").includes("upgrade-insecure-requests") && !dev.includes("upgrade-insecure-requests"), "upgrade-insecure-requests in production only");
}

/* ── production env check ─────────────────────────────────────────────────── */
{
  const good = "Zk3pQ9vL2mXr7TnB4yHcW8dFgJ1aSeUo5NiVbKx6RtYqPz0M";
  ok(authSecretProblem(good) === null, "a random 48-char secret passes");
  ok(authSecretProblem(undefined) !== null && authSecretProblem("short") !== null, "missing / short secrets fail");
  ok(authSecretProblem("a".repeat(48)) !== null && authSecretProblem("change-me-change-me-change-me-change-me") !== null && authSecretProblem("ligalokal-ligalokal-ligalokal-ligalokal") !== null, "repetitive / placeholder secrets fail");
  const base = { AUTH_SECRET: good, AUTH_URL: "https://liga.example.id", DATABASE_URL: "mysql://u:p@db/x" };
  ok(productionEnvProblems(base).length === 0, "a complete production env passes");
  ok(productionEnvProblems({ ...base, AUTH_URL: "http://liga.example.id" }).length === 1, "http AUTH_URL is refused in production");
  ok(productionEnvProblems({ ...base, AUTH_URL: undefined }).length === 1 && productionEnvProblems({ ...base, AUTH_URL: undefined, AUTH_TRUST_HOST: "true" }).length === 0, "needs AUTH_URL or an explicit AUTH_TRUST_HOST");
  ok(productionEnvProblems({ ...base, DATABASE_URL: undefined }).length === 1, "DATABASE_URL is required");
  ok(!productionEnvProblems({ ...base, AUTH_SECRET: "x" }).join("\n").includes(good), "problem messages never contain secret values");
}

/* ── seed guards ──────────────────────────────────────────────────────────── */
{
  ok(isLocalDatabase("mysql://root@127.0.0.1:3306/x") && isLocalDatabase("mysql://u:p@localhost/x") && isLocalDatabase("mysql://u@[::1]:3306/x"), "local database hosts");
  ok(!isLocalDatabase("mysql://u:p@srv123.hostinger.com/x") && !isLocalDatabase("mysql://u:p@10.0.0.5/x") && !isLocalDatabase("not a url") && !isLocalDatabase(undefined), "remote / malformed hosts are not local");
  ok(demoSeedBlocker({ NODE_ENV: "production" }) !== null && demoSeedBlocker({ APP_ENV: "production" }) !== null, "demo seed refuses in production");
  ok(demoSeedBlocker({ NODE_ENV: "production", ALLOW_DEMO_SEED: "1" }) === null && demoSeedBlocker({ NODE_ENV: "development" }) === null && demoSeedBlocker({}) === null, "…unless forced; fine in development");
  ok(wipeBlocker("mysql://root@127.0.0.1/x", {}) === null, "wipe of a local database is allowed");
  ok(wipeBlocker("mysql://u@srv.hostinger.com/x", {}) !== null && wipeBlocker("mysql://root@127.0.0.1/x", { NODE_ENV: "production" }) !== null, "wipe refuses a remote database or a production environment");
  ok(wipeBlocker("mysql://u@srv.hostinger.com/x", { ALLOW_DB_WIPE: "1" }) === null, "…unless ALLOW_DB_WIPE=1");
}

/* ── same-origin check ────────────────────────────────────────────────────── */
{
  const req = (headers: Record<string, string>) => new Request("http://app.test/api/x", { method: "POST", headers });
  ok(isSameOrigin(req({ host: "app.test" })), "no Origin header passes (non-browser)");
  ok(isSameOrigin(req({ host: "app.test", origin: "http://app.test" })), "same Origin passes");
  ok(!isSameOrigin(req({ host: "app.test", origin: "https://evil.example" })), "foreign Origin is refused");
  ok(!isSameOrigin(req({ host: "app.test", origin: "null" })), "opaque Origin is refused");
  ok(isSameOrigin(req({ host: "127.0.0.1:3000", "x-forwarded-host": "liga.example.id", origin: "https://liga.example.id" })), "Origin matching x-forwarded-host passes behind a proxy");
}

/* ── proxy matcher: gates pages, skips only real static files ─────────────── */
{
  const src = /matcher:\s*\[\s*(?:\/\*[\s\S]*?\*\/\s*)?("(?:[^"\\]|\\.)*")/.exec(read("proxy.ts"))?.[1];
  ok(!!src, "found the matcher in proxy.ts");
  if (src) {
    const re = new RegExp("^" + (JSON.parse(src) as string) + "$");
    const gated = (p: string) => re.test(p);
    for (const p of ["/", "/login", "/command-center", "/kompetisi/abc/jadwal", "/registry/pemain/x.png", "/registry/pemain/x.js", "/api/search", "/api/media", "/api/cloudinary/sign", "/dsp"]) {
      ok(gated(p), `proxy runs for ${p}`);
    }
    for (const p of ["/_next/static/chunks/a.js", "/_next/image", "/api/auth/session", "/api/auth/callback/credentials", "/login/player-1.webp", "/landing/logo-dark.png", "/Web/favicon.ico", "/templates/players.csv", "/logo-font-putih.png", "/favicon.ico"]) {
      ok(!gated(p), `proxy skips ${p}`);
    }
  }
}

/* ── no demo credentials in anything the browser can load ─────────────────── */
{
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(rel);
    }
  };
  walk("app");
  walk("components");
  const offenders = files.filter((f) => /^\s*["']use client["']/m.test(read(f).slice(0, 400)) && /demo-accounts/.test(read(f)));
  ok(offenders.length === 0, `no "use client" file imports lib/demo-accounts${offenders.length ? ": " + offenders.join(", ") : ""}`);
  const importers = [...files, "lib/auth/credentials.ts"].filter((f) => /from ["']@\/lib\/demo-accounts["']/.test(read(f)));
  ok(importers.every((f) => f === "lib/auth/credentials.ts"), `only the server login path imports demo-accounts from app code (${importers.join(", ") || "none"})`);
  const loginUi = read("app/(auth)/login/login-form.tsx") + read("app/(auth)/login/page.tsx") + read("components/app/topbar.tsx");
  ok(!/demo/i.test(loginUi), "login page and topbar contain no \"demo\"");
}

passwordChecks().then(() => {
  console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
});
