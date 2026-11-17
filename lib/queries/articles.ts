import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, users } from "@/lib/db/schema";

export const ARTICLE_PAGE_SIZE = 12;

/** The columns a card needs — the body stays out of lists. */
const cardColumns = {
  id: articles.id,
  title: articles.title,
  excerpt: articles.excerpt,
  coverUrl: articles.coverUrl,
  status: articles.status,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  authorName: users.name,
  /** Start of the body, for a teaser when the writer left the summary empty. */
  bodyPreview: sql<string>`left(${articles.body}, 400)`,
};

/**
 * Articles for the list page. `includeDrafts` is for people who may edit articles; everyone else
 * (visitors included) only ever gets published ones. `status` narrows a manager's view.
 */
export async function listArticles(opts: { includeDrafts: boolean; q?: string; status?: string; page?: number }) {
  const conds: SQL[] = [];
  if (!opts.includeDrafts) conds.push(eq(articles.status, "published"));
  else if (opts.status === "draft" || opts.status === "published") conds.push(eq(articles.status, opts.status));
  const q = opts.q?.trim();
  if (q) conds.push(or(like(articles.title, `%${q}%`), like(articles.excerpt, `%${q}%`))!);
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, opts.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(cardColumns)
      .from(articles)
      .leftJoin(users, eq(users.id, articles.authorId))
      .where(where)
      // drafts have no publish date yet: newest edit first among them
      .orderBy(desc(articles.publishedAt), desc(articles.updatedAt))
      .limit(ARTICLE_PAGE_SIZE)
      .offset((page - 1) * ARTICLE_PAGE_SIZE),
    db.select({ total: count() }).from(articles).where(where),
  ]);
  return { rows, total, page, pageSize: ARTICLE_PAGE_SIZE };
}

/** A single article with its body; a draft is returned only when `includeDrafts`. */
export async function getArticle(id: string, includeDrafts: boolean) {
  const [row] = await db
    .select({ ...cardColumns, body: articles.body })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(includeDrafts ? eq(articles.id, id) : and(eq(articles.id, id), eq(articles.status, "published")))
    .limit(1);
  return row ?? null;
}

/** The newest published articles, for the home page. */
export async function getLatestArticles(limit = 3) {
  return db
    .select({ id: articles.id, title: articles.title, excerpt: articles.excerpt, bodyPreview: sql<string>`left(${articles.body}, 400)`, coverUrl: articles.coverUrl, publishedAt: articles.publishedAt })
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt), desc(articles.updatedAt))
    .limit(limit);
}
