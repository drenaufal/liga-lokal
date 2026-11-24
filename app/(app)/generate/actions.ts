"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, printTemplates } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { assertCompetitionAccess } from "@/lib/competition-access";
import { auditText, recordAudit } from "@/lib/audit";
import { mediaIdFromUrl } from "@/lib/media";
import { releaseReplaced, releaseMedia } from "@/lib/media-store";
import { PRINT_KINDS, normalizeLayout, printLayoutSchema, type PrintKind } from "@/lib/print/layout";
import { getT } from "@/lib/i18n/server";
import type { Capability } from "@/lib/auth/rbac";

const TEMPLATE_CAP: Record<PrintKind, Capability> = {
  name_tag: "generate.nametag:template",
  certificate: "generate.certificate:template",
};
const PAGE: Record<PrintKind, string> = { name_tag: "/generate/name-tag", certificate: "/generate/sertifikat" };

const target = z.object({ competitionId: z.string().uuid(), kind: z.enum(PRINT_KINDS) });

async function load(competitionId: string, kind: PrintKind) {
  const [row] = await db
    .select()
    .from(printTemplates)
    .where(and(eq(printTemplates.competitionId, competitionId), eq(printTemplates.kind, kind)));
  return row ?? null;
}

/**
 * Sets (or replaces) the background image of a Turnamen's name tag or certificate. The image is
 * an uploaded `media` image; the layout is kept, so a corrected copy of the same design keeps
 * its positions.
 */
export async function saveTemplateImage(input: { competitionId: string; kind: string; imageUrl: string; width: number; height: number }) {
  const t = await getT();
  const v = target
    .extend({ imageUrl: z.string(), width: z.number().int().min(50).max(20000), height: z.number().int().min(50).max(20000) })
    .parse(input);
  const user = await actionUser(TEMPLATE_CAP[v.kind]);
  await assertCompetitionAccess(v.competitionId);
  const mediaId = mediaIdFromUrl(v.imageUrl);
  const [file] = mediaId ? await db.select({ kind: media.kind }).from(media).where(eq(media.id, mediaId)) : [];
  if (!file || file.kind !== "image") throw new Error(t("Template harus berupa gambar yang diunggah."));

  const before = await load(v.competitionId, v.kind);
  if (before) {
    await db
      .update(printTemplates)
      .set({ imageUrl: v.imageUrl, width: v.width, height: v.height, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(printTemplates.id, before.id));
    await releaseReplaced(before.imageUrl, v.imageUrl);
  } else {
    await db.insert(printTemplates).values({
      competitionId: v.competitionId,
      kind: v.kind,
      imageUrl: v.imageUrl,
      width: v.width,
      height: v.height,
      updatedBy: user.id,
    });
  }
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: before ? "print-template.replace" : "print-template.create",
    entityType: "competition", entityId: v.competitionId,
    summary: auditText(before ? "Template {kind} diganti ({w}×{h} px)" : "Template {kind} diunggah ({w}×{h} px)", { kind: v.kind === "name_tag" ? "name tag" : "sertifikat", w: v.width, h: v.height }),
  });
  revalidatePath(PAGE[v.kind]);
}

/** Saves where each value is printed. */
export async function saveTemplateLayout(input: { competitionId: string; kind: string; layout: unknown }) {
  const t = await getT();
  const v = target.extend({ layout: printLayoutSchema }).safeParse(input);
  if (!v.success) throw new Error(t("Tata letak tidak valid."));
  const user = await actionUser(TEMPLATE_CAP[v.data.kind]);
  await assertCompetitionAccess(v.data.competitionId);
  const row = await load(v.data.competitionId, v.data.kind);
  if (!row) throw new Error(t("Unggah template terlebih dahulu."));
  const layout = normalizeLayout(v.data.kind, v.data.layout);
  await db.update(printTemplates).set({ layout, updatedBy: user.id, updatedAt: new Date() }).where(eq(printTemplates.id, row.id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "print-template.layout", entityType: "competition", entityId: v.data.competitionId,
    summary: auditText("Tata letak template {kind} diperbarui", { kind: v.data.kind === "name_tag" ? "name tag" : "sertifikat" }),
  });
  revalidatePath(PAGE[v.data.kind]);
}

/** Removes a Turnamen's template (and its stored image). */
export async function removeTemplate(input: { competitionId: string; kind: string }) {
  const v = target.parse(input);
  const user = await actionUser(TEMPLATE_CAP[v.kind]);
  await assertCompetitionAccess(v.competitionId);
  const row = await load(v.competitionId, v.kind);
  if (!row) return;
  await db.delete(printTemplates).where(eq(printTemplates.id, row.id));
  await releaseMedia(row.imageUrl);
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "print-template.delete", entityType: "competition", entityId: v.competitionId,
    summary: auditText("Template {kind} dihapus", { kind: v.kind === "name_tag" ? "name tag" : "sertifikat" }),
  });
  revalidatePath(PAGE[v.kind]);
}
