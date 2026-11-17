import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FilePenLine, Plus } from "lucide-react";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listArticles } from "@/lib/queries/articles";
import { articleSummary } from "@/lib/articles";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { FilterChips, hrefWith } from "@/components/app/filter-chips";
import { Pagination, SearchBox } from "@/components/app/list-controls";
import { getI18n } from "@/lib/i18n/server";
import { ArticleCover } from "./article-cover";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Artikel") };
}
export const dynamic = "force-dynamic";

/**
 * Articles. Visitors and readers see the published ones; people who may edit articles also see
 * drafts (marked) and can filter by status. Writing needs `article:create`.
 */
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("article:view");
  const { q, status, page } = await searchParams;
  const canCreate = can(user, "article:create");
  const canEdit = can(user, "article:edit");
  const status_ = canEdit && (status === "draft" || status === "published") ? status : undefined;
  const { rows, total, page: current, pageSize } = await listArticles({ includeDrafts: canEdit, q, status: status_, page: Number(page) || 1 });

  const kept = { q, status: status_ };
  const chips = [
    { key: "all", label: t("Semua"), href: hrefWith("/artikel", kept, { status: null, page: null }), active: !status_ },
    { key: "published", label: t("Terbit"), href: hrefWith("/artikel", kept, { status: "published", page: null }), active: status_ === "published" },
    { key: "draft", label: t("Draf"), href: hrefWith("/artikel", kept, { status: "draft", page: null }), active: status_ === "draft" },
  ];
  const create = canCreate ? (
    <Button href="/artikel/baru">
      <Plus /> {t("Artikel Baru")}
    </Button>
  ) : undefined;

  return (
    <div>
      <PageHeader title={t("Artikel")} description={t("Berita, laporan pekan, dan cerita dari kompetisi dan pembinaan pemain.")} actions={create} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
          <SearchBox placeholder={t("Cari judul atau ringkasan…")} />
          {canEdit && <FilterChips items={chips} label={t("Filter status artikel")} />}
          <span className="text-[11px] text-ink-muted sm:ml-auto">{t("{n} artikel", { n: total })}</span>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={FilePenLine}
          title={q || status_ ? t("Tidak ada artikel yang cocok") : t("Belum ada artikel")}
          description={q || status_ ? t("Ubah pencarian atau filter untuk melihat artikel lain.") : t("Artikel yang sudah terbit akan tampil di sini dan di halaman utama.")}
          action={create}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((a) => (
              <article key={a.id} className="group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(20,20,20,0.5)]">
                <ArticleCover url={a.coverUrl} title={a.title} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                    {a.status === "draft" ? (
                      <Badge tone="warn">{t("Draf")}</Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {a.publishedAt ? fmt.date(a.publishedAt, { day: "numeric", month: "long", year: "numeric" }) : "—"}
                      </span>
                    )}
                    {a.authorName && <span>· {a.authorName}</span>}
                  </div>
                  <h2 className="mt-2 line-clamp-2 font-display text-2xl uppercase leading-tight">
                    <Link href={`/artikel/${a.id}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                      {a.title}
                    </Link>
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-secondary">{articleSummary({ excerpt: a.excerpt, body: a.bodyPreview })}</p>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={current} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
