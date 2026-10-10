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
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formatLabel } from "@/lib/ku";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTournamentBase(id);
  return { title: t?.name ?? "KU" };
}

export default async function KuLayout({
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
  const code = t.ageCategory?.code ?? null;

  return (
    <div>
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/kompetisi" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Semua turnamen
        </Link>
        <span>/</span>
        <Link href={`/kompetisi/${t.competition.id}`} className="font-medium text-ink-secondary hover:text-ink">
          {t.competition.name}
        </Link>
      </nav>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {code && <Badge tone="brand">{code}</Badge>}
            <h1 className="text-lg font-semibold tracking-tight text-ink">{t.competition.name}</h1>
            <StatusBadge kind="tournament" value={t.status} dot />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            {t.ageCategory && <span>{t.ageCategory.label}</span>}
            <span>{formatLabel(t.format)}</span>
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
          <p className="mt-2 text-[11px] text-ink-muted">
            Musim {t.competition.season}
            {t.competition.organizer ? ` · ${t.competition.organizer}` : ""}
          </p>
        </div>
        {(canManage || impact) && (
          <div className="flex shrink-0 flex-col items-end gap-3">
            {canManage && <LifecycleControl tournamentId={t.id} status={t.status} />}
            {impact && (
              <DeleteKu
                tournamentId={t.id}
                label={t.name}
                confirmText={code ?? t.competition.name}
                impact={impact}
              />
            )}
          </div>
        )}
      </div>

      <TournamentTabs id={t.id} format={t.format} hasGroups={t.groupCount > 0} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
