import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getCompetition, getKuFormOptions } from "@/lib/queries/competition";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { KuForm } from "./ku-form";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tambah KU") };
}
export const dynamic = "force-dynamic";

export default async function NewKuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  await requireCapability("ku:create");
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
        <ArrowLeft className="size-3.5" /> {t("Kembali ke {name}", { name: competition.name })}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Tambah KU")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {rich(t("KU dibuat dengan status <b>Draf</b> di dalam <b>{name}</b> (musim {season}). Jadwal dapat dibuat otomatis, manual, atau diunggah setelah peserta ditetapkan.", { name: competition.name, season: competition.season }))}
      </p>
      <Card className="mt-5">
        <CardContent>
          {ages.length === 0 ? (
            <EmptyState
              title={t("Belum ada kategori usia")}
              description={t("Tambahkan kategori usia di Registry → Kategori Usia sebelum membuat KU.")}
            />
          ) : allUsed ? (
            <EmptyState
              title={t("Semua kategori usia sudah dipakai")}
              description={t("Setiap KU hanya sekali per turnamen. Tambahkan kategori usia baru di Registry → Kategori Usia.")}
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
