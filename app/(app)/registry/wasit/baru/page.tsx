import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { RefereeForm } from "../referee-form";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Registrasi Wasit Baru") };
}

export default async function NewRefereePage() {
  const t = await getT();
  await requireCapability("registry.referee:create");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/wasit"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Registrasi Wasit Baru")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Status lisensi dihitung otomatis dari tanggal berlaku. Wasit dengan lisensi aktif dapat ditugaskan ke pertandingan.")}
      </p>
      <Card className="mt-5">
        <CardContent>
          <RefereeForm />
        </CardContent>
      </Card>
    </div>
  );
}
