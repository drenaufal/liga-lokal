import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "./credentials";
import { assertProductionEnv, envFlag } from "@/lib/env";
import type { Role } from "./rbac";

// Refuse to start production with a missing/weak AUTH_SECRET (no-op in dev and during `next build`).
assertProductionEnv();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Sessions are signed JWTs in an httpOnly cookie. They slide: the cookie is re-issued after
 * `updateAge` of activity and dies after `maxAge` of inactivity. Role and "active" are always
 * re-read from the database (see getCurrentUser), so deactivating an account or changing its role
 * takes effect on the next request regardless of this lifetime.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_UPDATE_AGE_SECONDS = 60 * 30;

/**
 * Which Host the app trusts when building callback/redirect URLs. In production that is the
 * pinned `AUTH_URL`, or an explicit `AUTH_TRUST_HOST=true` behind a proxy you control — never
 * unconditionally (a spoofed Host header could otherwise steer redirects). Outside production
 * it stays open so localhost and LAN testing just work.
 */
const trustHost = !IS_PRODUCTION || !!process.env.AUTH_URL || envFlag(process.env.AUTH_TRUST_HOST);

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: SESSION_UPDATE_AGE_SECONDS },
  trustHost,
  debug: false, // never log tokens/credentials, in any environment
  // Production: Secure cookies, and the session cookie gets the `__Host-` prefix (HTTPS only,
  // no Domain attribute, Path=/), so a sibling subdomain cannot overwrite it.
  useSecureCookies: IS_PRODUCTION,
  cookies: IS_PRODUCTION
    ? {
        sessionToken: {
          name: "__Host-authjs.session-token",
          options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
        },
      }
    : undefined,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(raw, request) {
        return authenticateCredentials(raw, request);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.title = user.title ?? null;
        token.clubId = user.clubId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.title = (token.title as string | null) ?? null;
        session.user.clubId = (token.clubId as string | null) ?? null;
      }
      return session;
    },
  },
});
