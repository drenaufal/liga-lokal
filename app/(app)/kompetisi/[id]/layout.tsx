import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Gauge } from "lucide-react";
import { getTournamentBase, getTournamentImpact } from "@/lib/queries/competition";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { TournamentTabs } from "./tabs";
import { LifecycleControl } from "./lifecycle-control";
import { DeleteTournament } from "./delete-tournament";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/utils";

const FORMAT_LABEL: Record<string, string> = {
  cup: "Piala — Fase Grup + Gugur",
  league: "Liga — Round-robin",
  hybrid: "Hybrid",
  knockout: "Sistem Gugur",
};

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTournamentBase(id);
  if (!t) notFound();
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");
  const canDelete = can(user?.role, "competition:delete");
  const impact = canDelete ? await getTournamentImpact(id) : null;

  return (
    <div>
      <Link
        href="/kompetisi"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Semua kompetisi
      </Link>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink">{t.name}</h1>
            <StatusBadge kind="tournament" value={t.status} dot />
            {t.ageCategory && <Badge tone="info">{t.ageCategory.code}</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            <span>{FORMAT_LABEL[t.format]}</span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {t.startDate ? formatDate(t.startDate) : "—"} – {t.endDate ? formatDate(t.endDate) : "—"}
            </span>
            {t.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {t.city}
              </span>
            )}
            {t.scoringFormula && (
              <span className="flex items-center gap-1">
                <Gauge className="size-3 text-brand" /> {t.scoringFormula.name}
              </span>
            )}
          </div>
          {t.description && (
            <p className="mt-2 max-w-2xl text-xs text-ink-muted">{t.description}</p>
          )}
        </div>
        {(canManage || impact) && (
          <div className="flex shrink-0 flex-col items-end gap-3">
            {canManage && <LifecycleControl tournamentId={t.id} status={t.status} />}
            {impact && <DeleteTournament tournamentId={t.id} name={t.name} impact={impact} />}
          </div>
        )}
      </div>

      <TournamentTabs id={t.id} format={t.format} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
