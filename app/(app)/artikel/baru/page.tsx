import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { ArticleForm } from "../article-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Artikel Baru") };
}

export default async function NewArticlePage() {
  const { t } = await getI18n();
  await requireCapability("article:create");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/artikel" className="mb-5 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> {t("Semua artikel")}
      </Link>
      <PageHeader title={t("Artikel Baru")} description={t("Tulis artikel, lalu simpan sebagai draf atau langsung terbitkan.")} />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <ArticleForm />
        </CardContent>
      </Card>
    </div>
  );
}
