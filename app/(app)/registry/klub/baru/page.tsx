import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { ClubForm } from "../club-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Registrasi SSB Baru") };
}

export default async function NewClubPage() {
  const t = await getT();
  await requireCapability("registry.club:create");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/klub"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Registrasi SSB")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Logo SSB tampil di jadwal, klasemen, bagan, dan konsol pertandingan.")}
      </p>
      <Card className="mt-5">
        <CardContent>
          <ClubForm />
        </CardContent>
      </Card>
    </div>
  );
}
