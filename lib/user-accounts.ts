import { z } from "zod";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ASSIGNABLE_ROLES, ROLES, type Role } from "@/lib/auth/rbac";

const identity = {
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid").max(255)),
  title: z.string().trim().max(120, "Jabatan maksimal 120 karakter").default(""),
  active: z.boolean().default(true),
};
const password = z.string().min(8, "Kata sandi minimal 8 karakter").max(72, "Kata sandi maksimal 72 byte")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Kata sandi maksimal 72 byte");

export const newUserSchema = z.object({ ...identity, password, role: z.enum(ASSIGNABLE_ROLES, "Pilih peran yang valid") });
export const editUserSchema = z.object({
  ...identity,
  password: z.preprocess((v) => (v === "" ? undefined : v), password.optional()),
  // absent when the role cannot be changed (own account, coach account)
  role: z.enum(ROLES).optional(),
});

export class UserRuleError extends Error {}
export class UserEmailExists extends UserRuleError {
  constructor() { super("Email sudah terdaftar."); }
}

type Actor = { id: string; role: Role };
const isAdminLevel = (role: Role) => role === "admin" || role === "super_admin";

function duplicateEmail(error: unknown) {
  const cause = error as { code?: string; cause?: { code?: string } };
  return cause.code === "ER_DUP_ENTRY" || cause.cause?.code === "ER_DUP_ENTRY";
}

/** Call only after checking the `settings.users:create` capability in the server action. */
export async function createUserAccount(actor: Actor, input: z.input<typeof newUserSchema>) {
  const v = newUserSchema.parse(input);
  if (v.role === "admin" && !isAdminLevel(actor.role)) throw new UserRuleError("Hanya Administrator yang dapat membuat akun Administrator.");
  if (await db.query.users.findFirst({ where: eq(users.email, v.email), columns: { id: true } })) throw new UserEmailExists();
  const id = crypto.randomUUID();
  const passwordHash = await hash(v.password, 12);
  try {
    await db.insert(users).values({ id, name: v.name, email: v.email, title: v.title || null, active: v.active, role: v.role, passwordHash });
  } catch (error) {
    if (duplicateEmail(error)) throw new UserEmailExists();
    throw error;
  }
  return { id, name: v.name, email: v.email, title: v.title || null, role: v.role, active: v.active };
}

/** Call only after checking the `settings.users:edit` capability in the server action. */
export async function updateUserAccount(actor: Actor, id: string, input: z.input<typeof editUserSchema>) {
  const v = editUserSchema.parse(input);
  const before = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, name: true, email: true, title: true, role: true, active: true },
  });
  // the hidden Super Admin is invisible to everyone else, so it also "does not exist" for them
  if (!before || (before.role === "super_admin" && actor.role !== "super_admin")) throw new UserRuleError("Akun tidak ditemukan.");

  const isSelf = before.id === actor.id;
  // nobody can lock themselves out: own role, status and login email stay as they are
  const fixedRole = isSelf || before.role === "coach" || before.role === "super_admin";
  const role: Role = fixedRole ? before.role : v.role ?? before.role;
  const active = isSelf ? before.active : v.active;
  const email = isSelf ? before.email : v.email;

  if (role !== before.role) {
    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) throw new UserRuleError("Peran tersebut tidak dapat diberikan dari sini.");
    if ((role === "admin" || before.role === "admin") && !isAdminLevel(actor.role)) {
      throw new UserRuleError("Hanya Administrator yang dapat memberi atau mencabut peran Administrator.");
    }
  }
  if (before.role === "admin" && !isAdminLevel(actor.role) && (v.password || !active !== !before.active)) {
    throw new UserRuleError("Hanya Administrator yang dapat mengubah akun Administrator.");
  }

  // keep at least one active administrator able to manage the system
  const leavesAdmin = isAdminLevel(before.role) && before.active && (!isAdminLevel(role) || !active);
  if (leavesAdmin) {
    const [{ n }] = await db.select({ n: count() }).from(users)
      .where(and(inArray(users.role, ["admin", "super_admin"]), eq(users.active, true), ne(users.id, id)));
    if (!n) throw new UserRuleError("Harus ada minimal satu Administrator aktif.");
  }

  if (email !== before.email) {
    const taken = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (taken && taken.id !== id) throw new UserEmailExists();
  }
  const passwordHash = v.password ? await hash(v.password, 12) : undefined;
  try {
    await db.update(users).set({ name: v.name, email, title: v.title || null, role, active, ...(passwordHash ? { passwordHash } : {}) }).where(eq(users.id, id));
  } catch (error) {
    if (duplicateEmail(error)) throw new UserEmailExists();
    throw error;
  }
  return {
    before,
    after: { id, name: v.name, email, title: v.title || null, role, active, passwordChanged: !!passwordHash },
  };
}
