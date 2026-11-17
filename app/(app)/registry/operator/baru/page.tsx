import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { OperatorForm } from "../operator-form";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";
import { getCompetitionChoices } from "@/lib/operator-accounts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Operator Baru") };
}

export default async function NewOperatorPage() {
  const t = await getT();
  await requireCapability("registry.operator:create");
  const competitions = await getCompetitionChoices();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/registry/operator" className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Operator Baru")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Buat akun login untuk petugas konsol pertandingan. Perubahan tercatat pada jejak audit.")}
      </p>
      <Card className="mt-5">
        <CardContent>
          <OperatorForm competitions={competitions} />
        </CardContent>
      </Card>
    </div>
  );
}
