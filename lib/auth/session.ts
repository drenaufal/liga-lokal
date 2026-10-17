import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./index";
import { can, canAny, type Capability, type Role } from "./rbac";
import { getGrantsForRole } from "./permissions";
import { homeHref } from "@/lib/nav";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { cache } from "react";

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

/**
 * For server actions — resolves the session against the live DB row so that
 * actions keep working after a re-seed (session id may be stale; email is stable).
 * Throws instead of redirecting. Returns the account plus its resolved `grants`, so
 * an action can check further capabilities with `can(user, …)`.
 */
export async function actionUser(cap?: Capability) {
  const session = await getCurrentUser();
  if (!session?.email) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, session.email),
    columns: { id: true, name: true, email: true, role: true, clubId: true, active: true },
  });
  if (!dbUser?.active) throw new Error("Akun tidak ditemukan atau nonaktif. Silakan masuk kembali.");

  const user = { ...dbUser, grants: session.grants };
  if (cap && !can(user, cap)) throw new Error("Akses ditolak untuk tindakan ini.");
  return user;
}

/** Like {@link actionUser}, but accepts any one of several capabilities. */
export async function actionUserAny(caps: readonly Capability[]) {
  const user = await actionUser();
  if (!canAny(user, caps)) throw new Error("Akses ditolak untuk tindakan ini.");
  return user;
}
