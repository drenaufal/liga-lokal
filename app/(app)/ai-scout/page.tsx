import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, FileText, Users, Trophy, Radio } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listReports, listShortlists, getReportSubjectOptions } from "@/lib/queries/scout";
import { aiLiveMode } from "@/lib/ai/provider";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { TalentSearch } from "./talent-search";
import { ReportGenerators } from "./report-generators";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Scout & Insights" };
export const dynamic = "force-dynamic";

const KIND_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  player_analysis: { label: "Analisis Pemain", icon: Users },
  player_scout: { label: "Pemanduan Bakat", icon: Sparkles },
  match_summary: { label: "Ringkasan Laga", icon: Radio },
  competition_insight: { label: "Wawasan Kompetisi", icon: Trophy },
  talent_search: { label: "Pencarian Talenta", icon: Sparkles },
};

export default async function AiScoutPage() {
  const user = await requireCapability("scout:view");
  const canSearch = can(user, "scout:search");
  const canShortlist = can(user, "scout:shortlist");
  const canReport = can(user, "scout:report");
  const [reports, shortlists, options] = await Promise.all([
    listReports(),
    listShortlists(),
    canReport ? getReportSubjectOptions() : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="AI Scout & Insights"
        description="Pencarian talenta dengan bahasa natural dan laporan analisis otomatis berbasis data performa."
        actions={
          <Badge tone={aiLiveMode ? "violet" : "neutral"}>
            {aiLiveMode ? "Google Gemini aktif" : "Mode demo — berbasis data"}
          </Badge>
        }
      />

      {!aiLiveMode && (
        <div className="mb-4 rounded-xl border border-info/25 bg-info/5 p-3 text-xs text-ink-secondary">
          <strong className="text-ink">Mode demo:</strong> pencarian & laporan dihasilkan
          dari data performa nyata pada platform (percentil, per-90, tren) — bukan teks acak.
          Tambahkan <code className="text-info">GEMINI_API_KEY</code> pada environment untuk
          mengaktifkan Google Gemini secara otomatis.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {canSearch && <TalentSearch canShortlist={canShortlist} />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> Laporan Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <EmptyState className="m-4" title="Belum ada laporan" />
              ) : (
                <ul className="divide-y divide-line-soft">
                  {reports.map((r) => {
                    const meta = KIND_META[r.kind] ?? KIND_META.player_analysis;
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/ai-scout/laporan/${r.id}`}
                          className="flex items-start gap-3 p-3 transition-colors hover:bg-surface-2/40"
                        >
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-violet/25 bg-violet/10 text-violet">
                            <meta.icon className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-ink">
                              {r.result.headline}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink-muted">
                              {meta.label} · {r.subjectLabel} · {relativeTime(r.createdAt)}
                            </p>
                          </div>
                          <Badge tone={r.model === "demo" ? "neutral" : "violet"}>
                            {r.model === "demo" ? "demo" : "gemini"}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {options && <ReportGenerators options={options} />}

          <Card>
            <CardHeader>
              <CardTitle>Shortlist Tersimpan</CardTitle>
            </CardHeader>
            <CardContent>
              {shortlists.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">Belum ada shortlist.</p>
              ) : (
                <ul className="space-y-2">
                  {shortlists.map((s) => (
                    <li key={s.id} className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
                      <p className="text-xs font-medium text-ink">{s.name}</p>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {s.items.length} pemain · {relativeTime(s.createdAt)}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[10px] italic text-ink-muted">
                        &ldquo;{s.query}&rdquo;
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
