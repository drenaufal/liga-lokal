import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, UserRound } from "lucide-react";
import { requireViewerCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getArticle } from "@/lib/queries/articles";
import { articleParagraphs, readingMinutes } from "@/lib/articles";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/lib/i18n/server";
import { ArticleCover } from "../article-cover";
import { ArticleControls } from "../article-controls";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getI18n();
  // metadata is public: only a published article may lend its title
  const article = UUID.test(id) ? await getArticle(id, false) : null;
  return { title: article?.title ?? t("Artikel") };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, fmt } = await getI18n();
  const user = await requireViewerCapability("article:view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const canEdit = can(user, "article:edit");
  const canDelete = can(user, "article:delete");
  // a draft exists only for the people who may edit; everyone else gets a plain "not found"
  const article = await getArticle(id, canEdit);
  if (!article) notFound();
  const published = article.status === "published";

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/artikel" className="mb-5 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> {t("Semua artikel")}
      </Link>

      {article.coverUrl && <ArticleCover url={article.coverUrl} title={article.title} className="rounded-3xl" />}

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
          {!published && <Badge tone="warn">{t("Draf — belum terbit")}</Badge>}
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {fmt.date(article.publishedAt, { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
          {article.authorName && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" /> {article.authorName}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {t("{n} menit baca", { n: readingMinutes(article.body) })}
          </span>
        </div>
        <h1 className="mt-3 font-display text-4xl uppercase leading-[0.98] tracking-wide text-ink text-balance sm:text-5xl">{article.title}</h1>
        {article.excerpt && <p className="mt-4 text-lg font-medium leading-relaxed text-ink-secondary">{article.excerpt}</p>}
        {(canEdit || canDelete) && (
          <div className="mt-5">
            <ArticleControls id={article.id} title={article.title} published={published} canEdit={canEdit} canDelete={canDelete} />
          </div>
        )}
      </header>

      <div className="mt-8 space-y-5 border-t border-line pt-8 text-base leading-[1.8] text-ink-secondary">
        {articleParagraphs(article.body).map((p, i) => (
          <p key={i} className="whitespace-pre-line break-words">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
