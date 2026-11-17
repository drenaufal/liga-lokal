import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

/**
 * Creates (or refreshes) the hidden Super Admin account.
 *
 *   SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… npm run db:seed:super
 *
 * The credentials come from the environment on purpose: the account is hidden from
 * every other role, so its password must never be committed or added to
 * lib/demo-accounts.ts (the shared-password dev seed). This is the way to create the first
 * real account on a production database (the demo seed refuses to run there). Safe to re-run;
 * it rotates the password of an existing Super Admin and refuses to touch any
 * account that holds a different role. Requires migration 0007 to be applied.
 */
async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SUPER_ADMIN_EMAIL is not a valid email address.");
  if (password.length < 12 || new TextEncoder().encode(password).length > 72) throw new Error("SUPER_ADMIN_PASSWORD must be 12 characters or more (at most 72 bytes).");
  const { DEMO_PASSWORD } = await import("@/lib/demo-accounts");
  if (password === DEMO_PASSWORD) throw new Error("SUPER_ADMIN_PASSWORD must not be the shared demo password.");

  const { eq } = await import("drizzle-orm");
  const { hashPassword } = await import("@/lib/auth/password");
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));

  if (existing) {
    if (existing.role !== "super_admin") throw new Error(`${email} already exists with role "${existing.role}"; refusing to change it.`);
    await db.update(users).set({ passwordHash, active: true }).where(eq(users.id, existing.id));
    console.log(`Super Admin ${email} refreshed (password rotated, account active).`);
  } else {
    await db.insert(users).values({
      name: "Super Admin",
      email,
      passwordHash,
      role: "super_admin",
      title: "Pemilik Platform",
      active: true,
    });
    console.log(`Super Admin ${email} created.`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : "Super Admin seed failed"); process.exit(1); });
