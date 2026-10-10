import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Radio, CalendarDays, Users2, Layers, Trophy } from "lucide-react";
import { listCompetitions } from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kompetisi" };
export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  const rows = await listCompetitions();
  const user = await getCurrentUser();
  const canWrite = can(user?.role, "competition:write");

  return (
    <div>
      <PageHeader
        title="Competition & Rules"
        description="Satu turnamen memiliki banyak KU — masing-masing dengan format Liga atau Cup, jadwal, klasemen, dan peserta sendiri."
        actions={
          canWrite && (
            <Button size="sm" href="/kompetisi/baru">
              <Plus className="size-3.5" /> Turnamen Baru
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Belum ada turnamen"
          description={
            canWrite
              ? "Buat turnamen pertama, lalu tambahkan KU yang dipertandingkan di dalamnya."
              : "Turnamen akan tampil di sini setelah dibuat oleh operator."
          }
          action={
            canWrite ? (
              <Button size="sm" href="/kompetisi/baru">
                <Plus className="size-3.5" /> Buat turnamen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((c) => {
            const progress = c.totalMatches > 0 ? (c.playedMatches / c.totalMatches) * 100 : 0;
            return (
              <Link
                key={c.id}
                href={`/kompetisi/${c.id}`}
                className="group rounded-xl border border-line bg-surface/70 p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink group-hover:text-brand">{c.name}</h3>
                      {c.liveMatches > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-danger">
                          <Radio className="size-3 animate-live" /> {c.liveMatches} LANGSUNG
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Musim {c.season}
                      {c.organizer ? ` · ${c.organizer}` : ""}
                    </p>
                  </div>
                  <StatusBadge kind="tournament" value={c.status} dot />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {c.kus.length ? (
                    c.kus.map((k) => (
                      <Badge key={k.id} tone="info" className="!py-0">
                        {k.ageCode ?? "—"}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[11px] text-ink-muted">Belum ada KU</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" /> {c.kus.length} KU
                  </span>
                  <span className="flex items-center gap-1">
                    <Users2 className="size-3" /> {c.teams} SSB
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {c.startDate ? formatDate(c.startDate) : "—"}
                  </span>
                </div>

                {c.totalMatches > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
                      <span>Progres pertandingan</span>
                      <span className="tabular-nums">
                        {c.playedMatches} / {c.totalMatches}
                      </span>
                    </div>
                    <Progress value={progress} tone={progress === 100 ? "success" : "brand"} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
