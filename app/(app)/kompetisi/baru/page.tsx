import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { CompetitionForm } from "../competition-form";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Turnamen Baru") };
}

export default async function NewCompetitionPage() {
  const t = await getT();
  await requireCapability("competition:create");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/kompetisi"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Buat Turnamen Baru")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {rich(t("Isi data turnamennya dulu. Setelah itu, di halaman turnamen, tambahkan <b>KU</b> yang dipertandingkan — masing-masing dengan format, tanggal mulai, dan SSB pesertanya sendiri."))}
      </p>
      <Card className="mt-5">
        <CardContent>
          <CompetitionForm />
        </CardContent>
      </Card>
    </div>
  );
}
