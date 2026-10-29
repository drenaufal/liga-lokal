"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiReports, scoringFormulas, scoutShortlists } from "@/lib/db/schema";
import { actionUser, getClubScope } from "@/lib/auth/session";
import { auditText, recordAudit } from "@/lib/audit";
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
import { normalizeWeights } from "@/lib/scoring";
import { insertReturning } from "@/lib/db/returning";
import { getT } from "@/lib/i18n/server";

async function weights() {
  const f = await db.query.scoringFormulas.findFirst({
    where: eq(scoringFormulas.isActive, true),
  });
  return normalizeWeights(f?.weights);
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
  const t = await getT();
  await actionUser("scout:search");
  const query = String(formData.get("query") ?? "").trim().slice(0, 500);
  if (query.length < 4) return { error: t("Masukkan deskripsi talenta yang dicari (min 4 karakter).") };

  const filters = parseScoutQuery(query);
  const results = await runTalentSearch(filters, await weights(), await getClubScope());
  return { query, filters, results };
}

export async function saveShortlist(formData: FormData) {
  const t = await getT();
  const user = await actionUser("scout:shortlist");
  const name = String(formData.get("name") ?? "").trim() || t("Shortlist tanpa nama");
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
    summary: auditText('Shortlist "{name}" disimpan ({n} pemain)', { name, n: items.length }),
  });

  revalidatePath("/ai-scout");
}

export async function generatePlayerReport(formData: FormData) {
  const t = await getT();
  const user = await actionUser("scout:report");
  const playerId = String(formData.get("playerId"));
  const ctx = await getPlayerReportContext(playerId, await getClubScope());
  if (!ctx) throw new Error(t("Pemain tidak ditemukan"));

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
    t("Anda adalah pemandu bakat sepak bola akar rumput Indonesia. Tulis analisis objektif berbasis data dalam Bahasa Indonesia."),
    t("Analisis pemain berikut: {data}", { data: JSON.stringify(flat) }),
  );
  const result = gemini ?? demoPlayerAnalysis(flat, ctx.peers, t);

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
    summary: auditText("Laporan analisis AI dibuat untuk {name}", { name: p.name }),
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}

export async function generateMatchReport(formData: FormData) {
  const t = await getT();
  const user = await actionUser("scout:report");
  const matchId = String(formData.get("matchId"));
  const ctx = await getMatchReportContext(matchId);
  if (!ctx) throw new Error(t("Pertandingan tidak ditemukan"));

  const gemini = await generateWithGemini(
    t("Anda analis taktik sepak bola. Ringkas pertandingan berbasis data kejadian dalam Bahasa Indonesia."),
    t("Ringkas pertandingan: {data}", { data: JSON.stringify(ctx) }),
  );
  const result = gemini ?? demoMatchSummary(ctx, t);

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
    summary: auditText("Ringkasan AI pasca-laga dibuat: {home} v {away}", { home: ctx.home, away: ctx.away }),
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}

export async function generateCompetitionReport(formData: FormData) {
  const t = await getT();
  const user = await actionUser("scout:report");
  const tournamentId = String(formData.get("tournamentId"));
  const ctx = await getCompetitionReportContext(tournamentId);
  if (!ctx) throw new Error(t("Turnamen tidak ditemukan"));

  const gemini = await generateWithGemini(
    t("Anda analis kompetisi sepak bola. Berikan wawasan tren dan rekomendasi operator dalam Bahasa Indonesia."),
    t("Analisis kompetisi: {data}", { data: JSON.stringify(ctx) }),
  );
  const result = gemini ?? demoCompetitionInsight(ctx, t);

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
    summary: auditText("Analisis tren kompetisi AI dibuat: {name}", { name: ctx.name }),
  });

  revalidatePath("/ai-scout");
  redirect(`/ai-scout/laporan/${row.id}`);
}
