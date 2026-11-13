import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getCompetition } from "@/lib/queries/competition";
import { Card, CardContent } from "@/components/ui/card";
import { CompetitionForm } from "../../competition-form";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Ubah Turnamen") };
}
export const dynamic = "force-dynamic";

export default async function EditCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  await requireCapability("competition:edit");
  const { id } = await params;
  const competition = await getCompetition(id);
  if (!competition) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/kompetisi/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali ke turnamen")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Ubah Turnamen")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Nama dan musim tampil di setiap KU, jadwal, dan laporan turnamen ini. Perubahan tercatat pada jejak audit.")}
      </p>
      <Card className="mt-5">
        <CardContent>
          <CompetitionForm competition={competition} />
        </CardContent>
      </Card>
    </div>
  );
}
