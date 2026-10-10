"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiReports, scoringFormulas, scoutShortlists } from "@/lib/db/schema";
import { actionUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { parseScoutQuery, type ScoutFilters } from "@/lib/ai/parse";
import {
  demoCompetitionInsight,
  demoMatchSummary,
  demoPlayerAnalysis,
} from "@/lib/ai/demo";
import { AI_MODEL, generateWithGemini } from "@/lib/ai/provider";
import {
  getCompetitionReportContext,
  getMatchReportContext,
  getPlayerReportContext,
  runTalentSearch,
} from "@/lib/queries/scout";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { insertReturning } from "@/lib/db/returning";

async function weights() {
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
  });
  return f?.weights ?? DEFAULT_WEIGHTS;
}

export type SearchState = {
  query?: string;
  filters?: ScoutFilters;
  results?: {
    id: string;
    name: string;
    position: string;
    ageCode: string | null;
    club: string | null;
    photoUrl: string | null;
    goals: number;
    assists: number;
    saves: number;
    appearances: number;
    rating: number;
    fit: number;
  }[];
  error?: string;
} | undefined;

export async function runSearch(_prev: SearchState, formData: FormData): Promise<SearchState> {
  await actionUser("scout:use");
  const query = String(formData.get("query") ?? "").trim();
  if (query.length < 4) return { error: "Masukkan deskripsi talenta yang dicari (min 4 karakter)." };

  const filters = parseScoutQuery(query);
  const results = await runTalentSearch(filters, await weights());
  return { query, filters, results };
}

export async function saveShortlist(formData: FormData) {
  const user = await actionUser("scout:use");
  const name = String(formData.get("name") ?? "").trim() || "Shortlist tanpa nama";
  const query = String(formData.get("query") ?? "");
  const items = JSON.parse(String(formData.get("items") ?? "[]"));

  await db.insert(scoutShortlists).values({
    name,
    query,
    items,
    ownerId: user.id,
  });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "scout.shortlist",
    entityType: "scout_shortlist",
    summary: `Shortlist "${name}" disimpan (${items.length} pemain)`,
  });

  revalidatePath("/ai-scout");
}

export async function generatePlayerReport(formData: FormData) {
  const user = await actionUser("scout:use");
  const playerId = String(formData.get("playerId"));
  const ctx = await getPlayerReportContext(playerId);
  if (!ctx) throw new Error("Pemain tidak ditemukan");

  const p = ctx.player;
  const flat = {
    name: p.name,
    position: p.position,
    ageCode: p.ageCode,
    club: p.club,
    appearances: p.stat.appearances,
    minutesPlayed: p.stat.minutesPlayed,
    goals: p.stat.goals,
    assists: p.stat.assists,
    saves: p.stat.saves,
    tackles: p.stat.tackles,
    interceptions: p.stat.interceptions,
    keyPasses: p.stat.keyPasses,
    cleanSheets: p.stat.cleanSheets,
    yellowCards: p.stat.yellowCards,
    redCards: p.stat.redCards,
    motm: p.stat.motm,
    score: p.stat.score,
    rating: p.stat.rating,
  };

  const gemini = await generateWithGemini(
    "Anda adalah pemandu bakat sepak bola akar rumput Indonesia. Tulis analisis objektif berbasis data dalam Bahasa Indonesia.",
    `Analisis pemain berikut: ${JSON.stringify(flat)}`,
  );
  const result = gemini ?? demoPlayerAnalysis(flat, ctx.peers);

  const [row] = await insertReturning(db, aiReports, {
      kind: "player_analysis",
      subjectType: "player",
      subjectId: playerId,
      subjectLabel: p.name,
      result,
      model: gemini ? AI_MODEL : "demo",
      createdBy: user.id,
    });

  await recordAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "ai.report",
    entityType: "ai_report",
    entityId: row.id,
    summary: `Laporan analisis AI dibuat untuk ${p.name}`,
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}

export async function generateMatchReport(formData: FormData) {
  const user = await actionUser("scout:use");
  const matchId = String(formData.get("matchId"));
  const ctx = await getMatchReportContext(matchId);
  if (!ctx) throw new Error("Pertandingan tidak ditemukan");

  const gemini = await generateWithGemini(
    "Anda analis taktik sepak bola. Ringkas pertandingan berbasis data kejadian dalam Bahasa Indonesia.",
    `Ringkas pertandingan: ${JSON.stringify(ctx)}`,
  );
  const result = gemini ?? demoMatchSummary(ctx);

  const [row] = await insertReturning(db, aiReports, {
      kind: "match_summary",
      subjectType: "match",
      subjectId: matchId,
      subjectLabel: `${ctx.home} ${ctx.homeScore}-${ctx.awayScore} ${ctx.away}`,
      result,
      model: gemini ? AI_MODEL : "demo",
      createdBy: user.id,
    });

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "ai.report", entityType: "ai_report", entityId: row.id,
    summary: `Ringkasan AI pasca-laga dibuat: ${ctx.home} v ${ctx.away}`,
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}

export async function generateCompetitionReport(formData: FormData) {
  const user = await actionUser("scout:use");
  const tournamentId = String(formData.get("tournamentId"));
  const ctx = await getCompetitionReportContext(tournamentId);
  if (!ctx) throw new Error("Turnamen tidak ditemukan");

  const gemini = await generateWithGemini(
    "Anda analis kompetisi sepak bola. Berikan wawasan tren dan rekomendasi operator dalam Bahasa Indonesia.",
    `Analisis kompetisi: ${JSON.stringify(ctx)}`,
  );
  const result = gemini ?? demoCompetitionInsight(ctx);

  const [row] = await insertReturning(db, aiReports, {
      kind: "competition_insight",
      subjectType: "tournament",
      subjectId: tournamentId,
      subjectLabel: ctx.name,
      result,
      model: gemini ? AI_MODEL : "demo",
      createdBy: user.id,
    });

  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "ai.report", entityType: "ai_report", entityId: row.id,
    summary: `Analisis tren kompetisi AI dibuat: ${ctx.name}`,
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}
