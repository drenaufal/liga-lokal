"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, like, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clubs } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { changedSuffix, recordAudit } from "@/lib/audit";
import { imageUrlField } from "@/lib/media";
import { releaseReplaced } from "@/lib/media-store";
import { formError, optionalInt, type FormState } from "@/lib/form";
import { slugify } from "@/lib/utils";
import { insertReturning } from "@/lib/db/returning";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format #RRGGBB");

const clubSchema = z.object({
  name: z.string().trim().min(3, "Nama klub minimal 3 karakter"),
  shortName: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Singkatan 2–8 huruf/angka tanpa spasi"),
  type: z.enum(["club", "academy"], "Pilih jenis"),
  city: z.string().trim().min(2, "Kota wajib diisi"),
  province: z.string().trim().optional(),
  foundedYear: optionalInt(1900, new Date().getFullYear(), "Tahun berdiri tidak valid"),
  logoUrl: imageUrlField,
  primaryColor: hex,
  secondaryColor: hex,
  homeVenueId: z.string().optional(),
  contactName: z.string().trim().optional(),
  contactEmail: z.union([z.literal(""), z.email("Email tidak valid")]).optional(),
  contactPhone: z.string().trim().optional(),
  accreditation: z.string().trim().optional(),
});

type ClubInput = z.infer<typeof clubSchema>;

function toRow(v: ClubInput) {
  return {
    name: v.name,
    shortName: v.shortName,
    type: v.type,
    city: v.city,
    province: v.province || null,
    foundedYear: v.foundedYear ?? null,
    logoUrl: v.logoUrl || null,
    primaryColor: v.primaryColor,
    secondaryColor: v.secondaryColor,
    homeVenueId: v.homeVenueId || null,
    contactName: v.contactName || null,
    contactEmail: v.contactEmail || null,
    contactPhone: v.contactPhone || null,
    accreditation: v.accreditation || null,
  };
}

/** The short name is how CSV imports and match boards identify a club, so keep it unique. */
async function shortNameTaken(shortName: string, exceptId?: string) {
  const hit = await db.query.clubs.findFirst({
    where: exceptId
      ? and(like(clubs.shortName, shortName), ne(clubs.id, exceptId))
      : like(clubs.shortName, shortName),
    columns: { name: true },
  });
  return hit ? `Singkatan sudah dipakai ${hit.name}` : null;
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "klub";
  let slug = base;
  for (let i = 2; await db.query.clubs.findFirst({ where: eq(clubs.slug, slug), columns: { id: true } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function createClub(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("registry:write");
  const parsed = clubSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await shortNameTaken(row.shortName);
  if (taken) return formError({ shortName: taken }, formData);

  const [created] = await insertReturning(db, clubs, { ...row, slug: await uniqueSlug(row.name) });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "club.create",
    entityType: "club",
    entityId: created.id,
    summary: `Registrasi ${row.type === "academy" ? "akademi" : "klub"} baru: ${row.name} (${row.shortName})`,
  });

  revalidatePath("/registry/klub");
  redirect(`/registry/klub/${created.id}`);
}

export async function updateClub(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await actionUser("registry:write");
  const before = await db.query.clubs.findFirst({ where: eq(clubs.id, id) });
  if (!before) return { error: "Klub tidak ditemukan." };

  const parsed = clubSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);

  const row = toRow(parsed.data);
  const taken = await shortNameTaken(row.shortName, id);
  if (taken) return formError({ shortName: taken }, formData);

  await db.update(clubs).set(row).where(eq(clubs.id, id));
  await releaseReplaced(before.logoUrl, row.logoUrl);

  const changed = (Object.keys(row) as (keyof typeof row)[]).filter(
    (k) => (before[k] ?? null) !== (row[k] ?? null),
  );
  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: before.logoUrl !== row.logoUrl ? "club.logo" : "club.update",
    entityType: "club",
    entityId: id,
    summary: `Data klub ${row.name} diperbarui${changedSuffix(changed)}`,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, row[k]])),
  });

  revalidatePath("/registry/klub");
  revalidatePath(`/registry/klub/${id}`);
  redirect(`/registry/klub/${id}`);
}
