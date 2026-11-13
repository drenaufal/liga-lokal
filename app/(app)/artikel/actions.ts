"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { actionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { auditText, recordAudit } from "@/lib/audit";
import { formError, type FormState } from "@/lib/form";
import { makeArticleSchema } from "@/lib/articles";
import { getT } from "@/lib/i18n/server";

/** Pages that show articles: the list, the home page's article row. */
function refresh(id?: string) {
  revalidatePath("/artikel");
  if (id) revalidatePath(`/artikel/${id}`);
  revalidatePath("/");
}

export async function createArticle(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("article:create");
  const parsed = makeArticleSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);
  const a = parsed.data;
  const id = crypto.randomUUID();
  await db.insert(articles).values({
    id,
    title: a.title,
    excerpt: a.excerpt || null,
    body: a.body,
    coverUrl: a.coverUrl || null,
    status: a.status,
    authorId: user.id,
    publishedAt: a.status === "published" ? new Date() : null,
  });
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: a.status === "published" ? "article.publish" : "article.create", entityType: "article", entityId: id,
    summary: auditText(a.status === "published" ? "Artikel diterbitkan: {title}" : "Artikel dibuat (draf): {title}", { title: a.title }),
  });
  refresh(id);
  redirect(`/artikel/${id}`);
}

export async function updateArticle(id: string, _previous: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await actionUser("article:edit");
  const parsed = makeArticleSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError(t, parsed.error, formData);
  const before = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!before) return { error: t("Artikel tidak ditemukan.") };
  const a = parsed.data;
  await db.update(articles).set({
    title: a.title,
    excerpt: a.excerpt || null,
    body: a.body,
    coverUrl: a.coverUrl || null,
    status: a.status,
    // the date readers see is the first time it went live; pulling it back to draft keeps it
    publishedAt: a.status === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt,
    updatedAt: new Date(),
  }).where(eq(articles.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "article.update", entityType: "article", entityId: id,
    summary: auditText("Artikel diperbarui: {title}", { title: a.title }),
    before: { title: before.title, status: before.status }, after: { title: a.title, status: a.status },
  });
  refresh(id);
  redirect(`/artikel/${id}`);
}

/** Publish a draft, or take a published article back to draft. */
export async function setArticleStatus(id: string, status: "draft" | "published") {
  const t = await getT();
  const user = await actionUser("article:edit");
  if (status !== "draft" && status !== "published") throw new Error(t("Pilih status artikel"));
  const before = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!before) throw new Error(t("Artikel tidak ditemukan."));
  if (before.status === status) return;
  await db.update(articles).set({
    status,
    publishedAt: status === "published" ? (before.publishedAt ?? new Date()) : before.publishedAt,
    updatedAt: new Date(),
  }).where(eq(articles.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: status === "published" ? "article.publish" : "article.unpublish", entityType: "article", entityId: id,
    summary: auditText(status === "published" ? "Artikel diterbitkan: {title}" : "Artikel ditarik ke draf: {title}", { title: before.title }),
  });
  refresh(id);
}

export async function deleteArticle(id: string) {
  const t = await getT();
  const user = await actionUser("article:delete");
  const before = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!before) throw new Error(t("Artikel tidak ditemukan."));
  await db.delete(articles).where(eq(articles.id, id));
  await recordAudit({
    actorId: user.id, actorName: user.name, actorRole: user.role,
    action: "article.delete", entityType: "article", entityId: id,
    summary: auditText("Artikel dihapus: {title}", { title: before.title }),
  });
  refresh();
}
