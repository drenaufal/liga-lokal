import { z } from "zod";
import { imageUrlField } from "@/lib/media";
import type { TFunction } from "@/lib/i18n/translate";

export const ARTICLE_LIMITS = { title: 200, excerpt: 300, body: 20_000 } as const;

export const makeArticleSchema = (t: TFunction) =>
  z.object({
    title: z.string().trim().min(3, t("Judul minimal 3 karakter")).max(ARTICLE_LIMITS.title, t("Judul maksimal 200 karakter")),
    excerpt: z.string().trim().max(ARTICLE_LIMITS.excerpt, t("Ringkasan maksimal 300 karakter")).optional(),
    body: z.string().trim().min(20, t("Isi artikel minimal 20 karakter")).max(ARTICLE_LIMITS.body, t("Isi artikel maksimal 20.000 karakter")),
    coverUrl: imageUrlField(t),
    status: z.enum(["draft", "published"], t("Pilih status artikel")),
  });

/**
 * Article text is plain: a blank line starts a new paragraph, a single line break stays inside
 * one. The page renders each paragraph as text, so nothing a writer types is ever read as HTML.
 */
export function articleParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The teaser shown on cards: the writer's own summary, otherwise the start of the first paragraph. */
export function articleSummary(article: { excerpt: string | null; body: string }, max = 180): string {
  const own = article.excerpt?.trim();
  if (own) return own;
  const first = (articleParagraphs(article.body)[0] ?? "").replace(/\s+/g, " ");
  if (first.length <= max) return first;
  return first.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** Reading time in whole minutes at ~200 words a minute, never less than one. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
