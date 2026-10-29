import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Gauge } from "lucide-react";
import { getTournamentBase, getTournamentImpact } from "@/lib/queries/competition";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
import { TournamentTabs } from "./tabs";
import { LifecycleControl } from "./lifecycle-control";
import { DeleteKu } from "./delete-tournament";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formatLabel, categoryLabel } from "@/lib/ku";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tour = await getTournamentBase(id);
  return { title: tour?.name ?? "KU" };
}

export default async function KuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const tour = await getTournamentBase(id);
  if (!tour) notFound();
  const canManage = can(user, "ku:status");
  const canDelete = can(user, "ku:delete");
  const impact = canDelete ? await getTournamentImpact(id) : null;
  const code = tour.ageCategory?.code ?? null;

  return (
    <div>
      <nav aria-label={t("Jalur navigasi")} className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/kompetisi" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-3.5" /> {t("Semua turnamen")}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/kompetisi/${tour.competition.id}`} className="hover:text-ink">
          {tour.competition.name}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="font-medium text-ink-secondary">
          {code ?? t("KU")}
        </span>
      </nav>

      <div className="mb-5 rounded-xl border border-line bg-surface/70 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {code && <Badge tone="brand">{code}</Badge>}
          <h1 className="text-lg font-semibold tracking-tight text-ink">{tour.competition.name}</h1>
          <StatusBadge kind="tournament" value={tour.status} dot />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
          {tour.ageCategory && <span>{categoryLabel(t, tour.ageCategory.label)}</span>}
          <span>{t.dyn(formatLabel(tour.format))}</span>
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3" />
            {tour.startDate ? fmt.date(tour.startDate) : "—"} – {tour.endDate ? fmt.date(tour.endDate) : "—"}
          </span>
          {tour.city && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {tour.city}
            </span>
          )}
          {tour.scoringFormula && (
            <span className="flex items-center gap-1">
              <Gauge className="size-3 text-brand" /> {tour.scoringFormula.name}
            </span>
          )}
          <span className="text-ink-muted">
            {t("Musim {season}", { season: tour.competition.season })}
            {tour.competition.organizer ? ` · ${tour.competition.organizer}` : ""}
          </span>
        </div>

        {(canManage || impact) && (
          // Managing the KU (stage, delete) sits on its own line so it never crowds the title.
          <div className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-3 sm:flex-row sm:items-center sm:justify-between">
            {canManage ? <LifecycleControl tournamentId={tour.id} status={tour.status} /> : <span />}
            {impact && (
              <div className="self-start sm:self-auto">
                <DeleteKu
                  tournamentId={tour.id}
                  label={tour.name}
                  confirmText={code ?? tour.competition.name}
                  impact={impact}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <TournamentTabs id={tour.id} format={tour.format} hasGroups={tour.groupCount > 0} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
