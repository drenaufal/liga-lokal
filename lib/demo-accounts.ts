import type { Role } from "@/lib/auth/rbac";

/**
 * Development-only accounts created by `npm run db:seed` (and the DSP seed).
 *
 * SERVER / SCRIPT USE ONLY. Never import this file from a client component or anything that
 * ends up in the browser bundle: the password below is public. `scripts/test-security.ts`
 * fails if a "use client" file imports it.
 *
 * Safeguards for real deployments:
 *  - the seed scripts refuse to run when NODE_ENV/APP_ENV is "production" (lib/db/seed-guard.ts)
 *  - the credentials login rejects this password in production even if such an account exists
 *    (lib/auth/credentials.ts)
 * Create real accounts with `npm run db:seed:super` and the in-app user management.
 */
export const DEMO_PASSWORD = "ligalokal123";

export const DEMO_ACCOUNTS: {
  email: string;
  name: string;
  role: Role;
  title: string;
}[] = [
  {
    email: "admin@ligalokal.id",
    name: "Rangga Wibisono",
    role: "admin",
    title: "Kepala Sistem & Kompetisi",
  },
  {
    email: "operator@ligalokal.id",
    name: "Dewi Anggraini",
    role: "operator",
    title: "Operator Turnamen",
  },
  {
    email: "wasit@ligalokal.id",
    name: "Bambang Sudirman",
    role: "referee",
    title: "Wasit Nasional C-1",
  },
  {
    email: "pelatih@ligalokal.id",
    name: "Yusuf Maulana",
    role: "coach",
    title: "Pelatih Kepala — Garuda Muda FA",
  },
  {
    email: "scout@ligalokal.id",
    name: "Nadia Rahmawati",
    role: "scout",
    title: "Pemandu Bakat Regional",
  },
  {
    email: "peninjau@ligalokal.id",
    name: "Sekretariat Liga",
    role: "viewer",
    title: "Sekretariat & Media",
  },
];
