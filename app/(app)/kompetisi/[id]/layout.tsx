import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, Pencil, Plus, Radio, UserRound } from "lucide-react";
import { getCompetition, getCompetitionImpact, getCompetitionSummary } from "@/lib/queries/competition";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { CompetitionTabs } from "./tabs";
import { DeleteCompetition } from "./delete-competition";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await getCompetition(id);
  const { t } = await getI18n();
  return { title: c?.name ?? t("Turnamen") };
}

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { t } = await getI18n();
  const user = await requireViewerCapability("competition:view");
  const { id } = await params;
  const c = await getCompetition(id);
  if (!c) notFound();
  const canAddKu = can(user, "ku:create");
  const canEdit = can(user, "competition:edit");
  const canDelete = can(user, "competition:delete");
  const [summary, impact] = await Promise.all([
    getCompetitionSummary(id),
    canDelete ? getCompetitionImpact(id) : Promise.resolve(null),
  ]);

  return (
    <div>
      <nav aria-label={t("Jalur navigasi")} className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/kompetisi" className="inline-flex items-center gap-1.5 hover:text-ink">
          <ArrowLeft className="size-3.5" /> {t("Semua turnamen")}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page" className="font-medium text-ink-secondary">
          {c.name}
        </span>
      </nav>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink">{c.name}</h1>
            <StatusBadge kind="tournament" value={summary.status} dot />
            {summary.live > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-danger">
                <Radio className="size-3 animate-live" /> {t("{n} LANGSUNG", { n: summary.live })}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            <span>{t("Musim {season}", { season: c.season })}</span>
            <span className="flex items-center gap-1">
              <UserRound className="size-3" /> {c.organizer ?? t("Penyelenggara belum diisi")}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="size-3" /> {t("{n} KU", { n: summary.kus })}
            </span>
          </div>
          {c.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-xs text-ink-muted">{c.description}</p>}
        </div>
        {(canAddKu || canEdit || impact) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {canAddKu && (
              <Button size="sm" href={`/kompetisi/${c.id}/ku/baru`}>
                <Plus className="size-3.5" /> {t("Tambah KU")}
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" href={`/kompetisi/${c.id}/ubah`}>
                <Pencil className="size-3.5" /> {t("Ubah")}
              </Button>
            )}
            {impact && <DeleteCompetition competitionId={c.id} name={c.name} impact={impact} />}
          </div>
        )}
      </div>

      <CompetitionTabs id={c.id} />
      <div className="mt-5">{children}</div>
    </div>
  );
}
