import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireCapability } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { ArticleForm } from "../../article-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Ubah Artikel") };
}
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  await requireCapability("article:edit");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const article = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!article) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/artikel/${id}`} className="mb-5 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> {t("Kembali ke artikel")}
      </Link>
      <PageHeader title={t("Ubah Artikel")} description={article.title} />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <ArticleForm article={article} />
        </CardContent>
      </Card>
    </div>
  );
}
