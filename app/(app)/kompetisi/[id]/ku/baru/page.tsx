import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getCompetition, getKuFormOptions } from "@/lib/queries/competition";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { KuForm } from "./ku-form";

export const metadata: Metadata = { title: "Tambah KU" };
export const dynamic = "force-dynamic";

export default async function NewKuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("competition:write");
  const { id } = await params;
  const competition = await getCompetition(id);
  if (!competition) notFound();
  const { ages, formulas, clubs, usedAgeIds, playerCounts } = await getKuFormOptions(id);
  const allUsed = ages.length > 0 && ages.every((a) => usedAgeIds.includes(a.id));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/kompetisi/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke {competition.name}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Tambah KU</h1>
      <p className="mt-1 text-sm text-ink-muted">
        KU dibuat dengan status <strong>Draf</strong> di dalam <strong>{competition.name}</strong> (musim{" "}
        {competition.season}). Jadwal dapat dibuat otomatis, manual, atau diunggah setelah peserta ditetapkan.
      </p>
      <Card className="mt-5">
        <CardContent>
          {ages.length === 0 ? (
            <EmptyState
              title="Belum ada kategori usia"
              description="Tambahkan kategori usia di Registry → Kategori Usia sebelum membuat KU."
            />
          ) : allUsed ? (
            <EmptyState
              title="Semua kategori usia sudah dipakai"
              description="Setiap KU hanya sekali per turnamen. Tambahkan kategori usia baru di Registry → Kategori Usia."
            />
          ) : (
            <KuForm
              competitionId={id}
              ages={ages.map((a) => ({ id: a.id, code: a.code, label: a.label }))}
              usedAgeIds={usedAgeIds}
              formulas={formulas.map((f) => ({ id: f.id, name: f.name, isActive: f.isActive }))}
              clubs={clubs}
              playerCounts={playerCounts}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
