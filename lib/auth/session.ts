import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./index";
import { GUEST_GRANTS, can, canAny, type Capability, type Role } from "./rbac";
import { getGrantsForRole } from "./permissions";
import { homeHref } from "@/lib/nav";
import { db } from "@/lib/db";
import { coaches, users } from "@/lib/db/schema";
import { coachClubIds } from "@/lib/club-scope";
import { cache } from "react";
import { getSafeT } from "@/lib/i18n/server";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.email) return null;
  const account = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    columns: { id: true, name: true, email: true, role: true, title: true, clubId: true, active: true },
  });
  if (!account?.active) return null;
  // Effective capabilities come from the saved access matrix, so pass the user itself to can().
  const grants = await getGrantsForRole(account.role as Role);
  return { ...session.user, id: account.id, name: account.name, email: account.email, role: account.role, title: account.title, clubId: account.clubId, grants };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Where someone is sent when they open something they may not: their first allowed menu, or a "no access" page. */
function deniedTarget(user: { role: Role; grants: readonly Capability[] }, cap: Capability) {
  const home = homeHref(user);
  return home ? `${home}?denied=${encodeURIComponent(cap)}` : "/tanpa-akses";
}

/** Page guard: the signed-in user must hold the capability, otherwise they are redirected away. */
export async function requireCapability(cap: Capability) {
  const user = await requireUser();
  if (!can(user, cap)) redirect(deniedTarget(user, cap));
  return user;
}

/** Page/layout guard that passes when the user holds at least one of the capabilities. */
export async function requireAnyCapability(caps: readonly Capability[]) {
  const user = await requireUser();
  if (!canAny(user, caps)) redirect(deniedTarget(user, caps[0]));
  return user;
}

/** The read-only viewer behind a page that is open to visitors without an account. */
const GUEST = { role: "viewer" as Role, grants: GUEST_GRANTS, guest: true as const };

/** The SSB the signed-in account looks after: a coach's primary and second club (none for other accounts). */
export const getOwnClubIds = cache(async (): Promise<string[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const [coach] = await db
    .select({ clubId: coaches.clubId, secondClubId: coaches.secondClubId })
    .from(coaches)
    .where(eq(coaches.userId, user.id));
  return coachClubIds({ clubId: coach?.clubId ?? user.clubId, secondClubId: coach?.secondClubId });
});

/**
 * Which SSB the signed-in account may see: `null` = every SSB (it holds `scope:all-clubs`), else
 * the SSB it looks after (`getOwnClubIds`). A restricted account with no SSB gets `[]`, which shows
 * nothing. Read once per request; pages hand it to the queries (`clubScopeFilter` & co. in
 * lib/club-scope.ts) and refuse single records outside it (`inClubScope`).
 */
export const getClubScope = cache(async (): Promise<string[] | null> => {
  const user = await getCurrentUser();
  if (!user || can(user, "scope:all-clubs")) return null;
  return getOwnClubIds();
});

/** True when nobody (or no usable account) is signed in. Used to hide links that need an account. */
export const isGuest = cache(async () => !(await getCurrentUser()));

/**
 * Guard for the pages that are open to visitors. A signed-in person needs the capability, as
 * everywhere else; a visitor passes only for the read-only capabilities in `GUEST_GRANTS`, and
 * is otherwise sent to the login page. Returns something `can()` accepts either way.
 */
export async function requireViewerCapability(cap: Capability) {
  return requireAnyViewerCapability([cap]);
}

/** Like {@link requireViewerCapability}, but passes when at least one capability is held. */
export async function requireAnyViewerCapability(caps: readonly Capability[]) {
  const user = await getCurrentUser();
  if (user) {
    if (!canAny(user, caps)) redirect(deniedTarget(user, caps[0]));
    return user;
  }
  if (!canAny(GUEST, caps)) redirect("/login");
  return GUEST;
}

/**
 * For server actions — resolves the session against the live DB row so that
 * actions keep working after a re-seed (session id may be stale; email is stable).
 * Throws instead of redirecting. Returns the account plus its resolved `grants`, so
 * an action can check further capabilities with `can(user, …)`.
 */
export async function actionUser(cap?: Capability) {
  const t = await getSafeT();
  const session = await getCurrentUser();
  if (!session?.email) throw new Error(t("Sesi tidak ditemukan. Silakan masuk kembali."));

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, session.email),
    columns: { id: true, name: true, email: true, role: true, clubId: true, active: true },
  });
  if (!dbUser?.active) throw new Error(t("Akun tidak ditemukan atau nonaktif. Silakan masuk kembali."));

  const user = { ...dbUser, grants: session.grants };
  if (cap && !can(user, cap)) throw new Error(t("Akses ditolak untuk tindakan ini."));
  return user;
}

/** Like {@link actionUser}, but accepts any one of several capabilities. */
export async function actionUserAny(caps: readonly Capability[]) {
  const t = await getSafeT();
  const user = await actionUser();
  if (!canAny(user, caps)) throw new Error(t("Akses ditolak untuk tindakan ini."));
  return user;
}
