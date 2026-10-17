"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { venues } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { venueSchema } from "@/lib/venue";

export async function createVenue(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("registry.venue:create");
  const parsed = venueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);
  const v = parsed.data;
  const id = crypto.randomUUID();
  await db.insert(venues).values({
    id, name: v.name, city: v.city, province: v.province || null,
    address: v.address || null, surface: v.surface,
    capacity: v.capacity ?? null, fieldCount: v.fieldCount, floodlights: v.floodlights,
    photoUrl: v.photoUrl || null, notes: v.notes || null,
  });
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "venue.create", entityType: "venue", entityId: id,
    summary: `Venue didaftarkan: ${v.name} · ${v.city}`,
  });
  revalidatePath("/registry/venue");
  revalidatePath("/kompetisi", "layout");
  redirect("/registry/venue");
}

export async function updateVenue(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const user = await actionUser("registry.venue:edit");
  const parsed = venueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(parsed.error, formData);
  const before = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!before) return { error: "Venue tidak ditemukan." };
  const v = parsed.data;
  await db.update(venues).set({
    name: v.name, city: v.city, province: v.province || null,
    address: v.address || null, surface: v.surface,
    capacity: v.capacity ?? null, fieldCount: v.fieldCount, floodlights: v.floodlights,
    photoUrl: v.photoUrl || null, notes: v.notes || null,
  }).where(eq(venues.id, id));
  await recordAudit({ actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "venue.update", entityType: "venue", entityId: id, summary: "Venue diperbarui: " + v.name, before, after: v });
  revalidatePath("/registry/venue", "layout");
  revalidatePath("/kompetisi", "layout");
  revalidatePath("/match-ops", "layout");
  redirect("/registry/venue/" + id);
}
