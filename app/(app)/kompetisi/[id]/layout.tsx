import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, Pencil, Plus, UserRound } from "lucide-react";
import { getCompetition, getCompetitionImpact } from "@/lib/queries/competition";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitionTabs } from "./tabs";
import { DeleteCompetition } from "./delete-competition";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await getCompetition(id);
  return { title: c?.name ?? "Turnamen" };
}

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCompetition(id);
  if (!c) notFound();
  const user = await getCurrentUser();
  const canManage = can(user?.role, "competition:write");
  const canDelete = can(user?.role, "competition:delete");
  const impact = canDelete ? await getCompetitionImpact(id) : null;

  return (
    <div>
      <Link
        href="/kompetisi"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Semua turnamen
      </Link>

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-line bg-surface/70 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink">{c.name}</h1>
            <Badge tone="neutral">Musim {c.season}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            <span className="flex items-center gap-1">
              <UserRound className="size-3" /> {c.organizer ?? "Penyelenggara belum diisi"}
            </span>
            {impact && (
              <span className="flex items-center gap-1">
                <Layers className="size-3" /> {impact.kus} KU
              </span>
            )}
          </div>
          {c.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-xs text-ink-muted">{c.description}</p>}
        </div>
        {(canManage || impact) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {canManage && (
              <Button size="sm" href={`/kompetisi/${c.id}/ku/baru`}>
                <Plus className="size-3.5" /> Tambah KU
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" href={`/kompetisi/${c.id}/ubah`}>
                <Pencil className="size-3.5" /> Ubah
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
