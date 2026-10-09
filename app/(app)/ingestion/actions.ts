"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ageCategories,
  clubs,
  importBatches,
  importRows,
  players,
  referees,
  venues,
  type ImportIssue,
  type ImportStage,
} from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  ENTITY_SCHEMAS,
  STAGE_DEFS,
  freshStages,
  parseCsv,
  similarity,
} from "@/lib/ingestion";
import { insertReturning } from "@/lib/db/returning";
import type { PlayerPosition } from "@/lib/positions";
import { nextRegistrationNumbers } from "@/lib/registration";

function rev(id?: string) {
  revalidatePath("/ingestion");
  if (id) revalidatePath(`/ingestion/${id}`);
}

export async function uploadCsv(formData: FormData) {
  const user = await actionUser("ingestion:write");
  const entity = String(formData.get("entity"));
  const file = formData.get("file") as File | null;
  if (!file || !ENTITY_SCHEMAS[entity]) throw new Error("Berkas atau jenis entitas tidak valid");

  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  if (rows.length === 0) throw new Error("Berkas CSV kosong atau tidak terbaca");
  if (rows.length > 2000) throw new Error("Maksimal 2000 baris per unggahan");

  const schema = ENTITY_SCHEMAS[entity];
  const stages = freshStages();
  const missingCols = schema.required.filter((c) => !headers.includes(c));

  const [batch] = await insertReturning(db, importBatches, {
      entity: entity as "players" | "clubs" | "referees" | "venues" | "matches",
      fileName: file.name,
      status: "validating",
      totalRows: rows.length,
      stages,
      uploadedBy: user.id,
    });

  await db.insert(importRows).values(
    rows.map((raw, i) => ({
      batchId: batch.id,
      rowNumber: i + 2, // account for header row
      raw,
      status: "pending" as const,
      issues: [] as ImportIssue[],
    })),
  );

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "import.upload",
    entityType: "import_batch",
    entityId: batch.id,
    summary: `Unggah CSV "${file.name}" — ${rows.length} baris (${entity})`,
  });

  void missingCols;
  rev(batch.id);
  redirect(`/ingestion/${batch.id}`);
}

export async function runPipeline(formData: FormData) {
  const user = await actionUser("ingestion:write");
  const batchId = String(formData.get("batchId"));
  const batch = await db.query.importBatches.findFirst({
    where: eq(importBatches.id, batchId),
  });
  if (!batch) throw new Error("Batch tidak ditemukan");

  const schema = ENTITY_SCHEMAS[batch.entity];
  const rows = await db.select().from(importRows).where(eq(importRows.batchId, batchId));

  // reference data for cross-ref
  const [existingClubs, existingAges, existingPlayers, existingRefs, existingVenues] =
    await Promise.all([
      db.select({ id: clubs.id, name: clubs.name, short: clubs.shortName }).from(clubs),
      db.select({ id: ageCategories.id, code: ageCategories.code }).from(ageCategories),
      db.select({ id: players.id, name: players.fullName, dob: players.dob, nisn: players.nisn }).from(players),
      db.select({ id: referees.id, num: referees.licenseNumber }).from(referees),
      db.select({ id: venues.id, name: venues.name }).from(venues),
    ]);

  const existingKeys = new Map<string, { id: string; name: string }>();
  if (batch.entity === "players")
    existingPlayers.forEach((p) =>
      existingKeys.set(`${p.name.toLowerCase().replace(/\s+/g, "")}|${p.dob}`, { id: p.id, name: p.name }),
    );
  if (batch.entity === "clubs")
    existingClubs.forEach((c) => existingKeys.set(c.name.toLowerCase().replace(/\s+/g, ""), { id: c.id, name: c.name }));
  if (batch.entity === "referees")
    existingRefs.forEach((r) => existingKeys.set(r.num.toLowerCase(), { id: r.id, name: r.num }));
  if (batch.entity === "venues")
    existingVenues.forEach((v) => existingKeys.set(v.name.toLowerCase().replace(/\s+/g, ""), { id: v.id, name: v.name }));

  const seenInBatch = new Map<string, number>();
  const nisnOwner = new Map(
    existingPlayers.filter((p) => p.nisn).map((p) => [p.nisn as string, p.name]),
  );
  const nisnInBatch = new Map<string, number>();
  let valid = 0;
  let errors = 0;
  let dupes = 0;
  let review = 0;

  for (const row of rows) {
    const raw = row.raw as Record<string, string>;
    const issues: ImportIssue[] = [...schema.validate(raw)];

    // cross-reference checks
    if (batch.entity === "players") {
      if (raw.club_short && !existingClubs.some((c) => c.short.toLowerCase() === raw.club_short.toLowerCase()))
        issues.push({ field: "club_short", code: "crossref", message: `Klub "${raw.club_short}" tidak ditemukan di registry`, severity: "warning" });
      if (raw.age_category && !existingAges.some((a) => a.code.toLowerCase() === raw.age_category.toLowerCase()))
        issues.push({ field: "age_category", code: "crossref", message: `Kategori usia "${raw.age_category}" tidak dikenali`, severity: "warning" });
      if (raw.nisn) {
        const owner = nisnOwner.get(raw.nisn);
        if (owner)
          issues.push({ field: "nisn", code: "unique", message: `NISN sudah terdaftar atas nama ${owner}`, severity: "error" });
        else if (nisnInBatch.has(raw.nisn))
          issues.push({ field: "nisn", code: "unique", message: `NISN sama dengan baris ${nisnInBatch.get(raw.nisn)}`, severity: "error" });
        nisnInBatch.set(raw.nisn, row.rowNumber);
      }
    }

    const hasError = issues.some((i) => i.severity === "error");
    const key = schema.matchKey(raw);

    // exact duplicate against existing DB
    const exactExisting = existingKeys.get(key);
    // fuzzy candidate
    let fuzzy: { id: string; name: string; score: number } | null = null;
    if (!exactExisting && !hasError) {
      const nameField = raw.full_name ?? raw.name ?? "";
      const pool =
        batch.entity === "players" ? existingPlayers.map((p) => ({ id: p.id, name: p.name }))
        : batch.entity === "clubs" ? existingClubs.map((c) => ({ id: c.id, name: c.name }))
        : batch.entity === "venues" ? existingVenues.map((v) => ({ id: v.id, name: v.name }))
        : [];
      for (const cand of pool) {
        const s = similarity(nameField, cand.name);
        if (s >= 0.82 && (!fuzzy || s > fuzzy.score)) fuzzy = { ...cand, score: s };
      }
    }

    // duplicate within the same file
    const dupInBatch = seenInBatch.has(key);
    seenInBatch.set(key, row.rowNumber);

    let status: (typeof importRows.$inferSelect)["status"];
    let candId: string | null = null;
    let candName: string | null = null;
    let candScore: number | null = null;

    if (hasError) {
      status = "error";
      errors++;
    } else if (exactExisting || dupInBatch) {
      status = "duplicate";
      dupes++;
      candId = exactExisting?.id ?? null;
      candName = exactExisting?.name ?? `Baris ${seenInBatch.get(key)} dalam berkas ini`;
      candScore = 1;
    } else if (fuzzy) {
      status = "needs_review";
      review++;
      candId = fuzzy.id;
      candName = fuzzy.name;
      candScore = Math.round(fuzzy.score * 100) / 100;
    } else if (issues.some((i) => i.severity === "warning")) {
      status = "needs_review";
      review++;
    } else {
      status = "valid";
      valid++;
    }

    await db
      .update(importRows)
      .set({
        status,
        issues,
        normalized: schema.normalize(raw),
        matchCandidateId: candId,
        matchCandidateName: candName,
        matchScore: candScore,
      })
      .where(eq(importRows.id, row.id));
  }

  const stages: ImportStage[] = STAGE_DEFS.map((s) => {
    const counts: Record<string, number> = {
      schema: rows.length,
      normalize: rows.length,
      rules: valid + review,
      dedupe: dupes,
      crossref: rows.length,
      review,
    };
    if (s.key === "upload") return { key: s.key, label: s.label, status: "passed", count: rows.length };
    if (s.key === "commit") return { key: s.key, label: s.label, status: "pending" };
    if (s.key === "review")
      return {
        key: s.key,
        label: s.label,
        status: review > 0 ? "running" : "passed",
        count: review,
        detail: review > 0 ? `${review} baris menunggu keputusan` : "Tidak ada baris yang perlu ditinjau",
      };
    return {
      key: s.key,
      label: s.label,
      status: s.key === "dedupe" && errors === 0 ? "passed" : errors > 0 && s.key === "schema" ? "failed" : "passed",
      count: counts[s.key],
    };
  });

  await db
    .update(importBatches)
    .set({
      status: review > 0 ? "needs_review" : "staged",
      validRows: valid,
      errorRows: errors,
      duplicateRows: dupes,
      reviewRows: review,
      stages,
    })
    .where(eq(importBatches.id, batchId));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "import.validate",
    entityType: "import_batch",
    entityId: batchId,
    summary: `Pipeline QA dijalankan — ${valid} valid, ${review} perlu tinjauan, ${dupes} duplikat, ${errors} galat`,
  });

  rev(batchId);
  void and;
}

export async function resolveRow(formData: FormData) {
  const user = await actionUser("ingestion:write");
  const rowId = String(formData.get("rowId"));
  const batchId = String(formData.get("batchId"));
  const resolution = String(formData.get("resolution")); // approve | reject | merge

  const newStatus =
    resolution === "approve" ? "approved" : resolution === "reject" ? "rejected" : "duplicate";

  await db
    .update(importRows)
    .set({
      status: newStatus,
      resolution: resolution === "approve" ? "create" : resolution === "merge" ? "merge" : "skip",
      resolvedBy: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(importRows.id, rowId));

  // recount review rows
  const remaining = await db.$count(
    importRows,
    and(eq(importRows.batchId, batchId), eq(importRows.status, "needs_review")),
  );
  await db
    .update(importBatches)
    .set({
      reviewRows: remaining,
      status: remaining === 0 ? "staged" : "needs_review",
    })
    .where(eq(importBatches.id, batchId));

  rev(batchId);
}

export async function bulkResolve(formData: FormData) {
  const user = await actionUser("ingestion:write");
  const batchId = String(formData.get("batchId"));
  const resolution = String(formData.get("resolution"));

  const newStatus = resolution === "approve" ? "approved" : "rejected";
  await db
    .update(importRows)
    .set({
      status: newStatus,
      resolution: resolution === "approve" ? "create" : "skip",
      resolvedBy: user.id,
      resolvedAt: new Date(),
    })
    .where(and(eq(importRows.batchId, batchId), eq(importRows.status, "needs_review")));

  await db
    .update(importBatches)
    .set({ reviewRows: 0, status: "staged" })
    .where(eq(importBatches.id, batchId));

  rev(batchId);
}

export async function commitBatch(formData: FormData) {
  const user = await actionUser("ingestion:write");
  const batchId = String(formData.get("batchId"));
  const batch = await db.query.importBatches.findFirst({
    where: eq(importBatches.id, batchId),
  });
  if (!batch) throw new Error("Batch tidak ditemukan");

  const toImport = await db
    .select()
    .from(importRows)
    .where(eq(importRows.batchId, batchId));
  const committable = toImport.filter(
    (r) => r.status === "valid" || r.status === "approved",
  );

  const clubMap = new Map(
    (await db.select({ id: clubs.id, short: clubs.shortName }).from(clubs)).map((c) => [
      c.short.toLowerCase(),
      c.id,
    ]),
  );
  const ageMap = new Map(
    (await db.select({ id: ageCategories.id, code: ageCategories.code }).from(ageCategories)).map(
      (a) => [a.code.toLowerCase(), a.id],
    ),
  );

  let imported = 0;
  for (const row of committable) {
    const n = row.normalized as Record<string, unknown>;
    try {
      if (batch.entity === "players") {
        const [regNo] = await nextRegistrationNumbers(1);
        const [p] = await insertReturning(db, players, {
            fullName: String(n.fullName),
            nickname: (n.nickname as string) || null,
            nisn: String(n.nisn),
            registrationNo: regNo,
            dob: String(n.dob),
            position: n.position as PlayerPosition,
            foot: (n.foot as "left" | "right" | "both") || "right",
            jerseyNumber: (n.jerseyNumber as number) ?? null,
            heightCm: (n.heightCm as number) ?? null,
            weightKg: (n.weightKg as number) ?? null,
            birthPlace: (n.birthPlace as string) || null,
            guardianName: (n.guardianName as string) || null,
            guardianPhone: (n.guardianPhone as string) || null,
            clubId: n.clubShort ? clubMap.get(String(n.clubShort).toLowerCase()) ?? null : null,
            ageCategoryId: n.ageCategory ? ageMap.get(String(n.ageCategory).toLowerCase()) ?? null : null,
            verificationStatus: "pending",
          });
        await db.update(importRows).set({ status: "imported", importedEntityId: p.id }).where(eq(importRows.id, row.id));
      } else if (batch.entity === "clubs") {
        const [c] = await insertReturning(db, clubs, {
            name: String(n.name),
            shortName: String(n.shortName),
            slug: String(n.name).toLowerCase().replace(/[^\w]+/g, "-") + "-" + Date.now().toString(36),
            city: String(n.city),
            province: (n.province as string) || null,
            type: (n.type as "club" | "academy") || "club",
            foundedYear: (n.foundedYear as number) ?? null,
            contactEmail: (n.contactEmail as string) || null,
          });
        await db.update(importRows).set({ status: "imported", importedEntityId: c.id }).where(eq(importRows.id, row.id));
      } else if (batch.entity === "referees") {
        const [r] = await insertReturning(db, referees, {
            fullName: String(n.fullName),
            licenseLevel: String(n.licenseLevel),
            licenseNumber: String(n.licenseNumber),
            licenseExpiry: String(n.licenseExpiry),
            city: (n.city as string) || null,
            phone: (n.phone as string) || null,
            email: (n.email as string) || null,
          });
        await db.update(importRows).set({ status: "imported", importedEntityId: r.id }).where(eq(importRows.id, row.id));
      } else if (batch.entity === "venues") {
        const [v] = await insertReturning(db, venues, {
            name: String(n.name),
            city: String(n.city),
            province: (n.province as string) || null,
            capacity: (n.capacity as number) ?? null,
            fieldCount: (n.fieldCount as number) ?? 1,
            surface: (n.surface as "natural" | "artificial" | "hybrid" | "futsal") || "natural",
          });
        await db.update(importRows).set({ status: "imported", importedEntityId: v.id }).where(eq(importRows.id, row.id));
      }
      imported++;
    } catch (e) {
      await db
        .update(importRows)
        .set({
          status: "error",
          issues: [{ field: "_commit", code: "db", message: e instanceof Error ? e.message : "Gagal menyimpan", severity: "error" }],
        })
        .where(eq(importRows.id, row.id));
    }
  }

  const stages = (batch.stages as ImportStage[]).map((s) =>
    s.key === "commit"
      ? { ...s, status: "passed" as const, count: imported, detail: `${imported} entitas dibuat` }
      : s.key === "review"
        ? { ...s, status: "passed" as const }
        : s,
  );

  await db
    .update(importBatches)
    .set({
      status: "completed",
      importedRows: imported,
      completedAt: new Date(),
      stages,
    })
    .where(eq(importBatches.id, batchId));

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "import.commit",
    entityType: "import_batch",
    entityId: batchId,
    summary: `Impor "${batch.fileName}" diselesaikan — ${imported} ${batch.entity} masuk ke sistem`,
  });

  rev(batchId);
  revalidatePath("/registry/pemain");
  revalidatePath("/command-center");
}
