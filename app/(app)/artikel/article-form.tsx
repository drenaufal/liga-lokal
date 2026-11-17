"use client";

import { useActionState } from "react";
import { FileText, Loader2, Save, Send } from "lucide-react";
import { createArticle, updateArticle } from "./actions";
import type { Article } from "@/lib/db/schema";
import type { FormState } from "@/lib/form";
import { ARTICLE_LIMITS } from "@/lib/articles";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ImageUpload } from "@/components/app/image-upload";
import { useT } from "@/lib/i18n/client";

export function ArticleForm({ article }: { article?: Article }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    article ? updateArticle.bind(null, article.id) : createArticle,
    undefined,
  );
  const errors = state?.fieldErrors ?? {};
  const value = (key: "title" | "excerpt" | "body" | "coverUrl") => state?.values?.[key] ?? article?.[key] ?? "";
  const published = article?.status === "published";

  return (
    <form action={formAction} className="space-y-6">
      <fieldset disabled={pending} className="grid gap-4">
        <legend className="mb-4 flex items-center gap-2 text-sm font-bold">
          <FileText className="size-4 text-brand" /> {t("Isi artikel")}
        </legend>
        <Field label={t("Judul")} error={errors.title}>
          <Input name="title" aria-label={t("Judul")} required minLength={3} maxLength={ARTICLE_LIMITS.title} defaultValue={value("title")} placeholder={t("mis. Hasil lengkap pekan pembuka")} />
        </Field>
        <Field label={t("Ringkasan (opsional)")} error={errors.excerpt} hint={t("Satu atau dua kalimat yang tampil di kartu artikel. Kosongkan untuk memakai awal isi artikel.")}>
          <Textarea name="excerpt" aria-label={t("Ringkasan (opsional)")} rows={2} maxLength={ARTICLE_LIMITS.excerpt} defaultValue={value("excerpt")} />
        </Field>
        <Field label={t("Isi")} error={errors.body} hint={t("Teks biasa. Beri satu baris kosong untuk memulai paragraf baru.")}>
          <Textarea name="body" aria-label={t("Isi")} rows={14} required minLength={20} maxLength={ARTICLE_LIMITS.body} defaultValue={value("body")} className="leading-relaxed" />
        </Field>
        <div>
          <ImageUpload name="coverUrl" label={t("Gambar sampul (opsional)")} displayName={t("Sampul")} shape="square" defaultValue={value("coverUrl")} hint={t("Tampil di kartu dan di atas artikel · JPG, PNG, WEBP · maks 5 MB")} />
          {errors.coverUrl && <p className="mt-1 text-xs text-danger">{errors.coverUrl}</p>}
        </div>
      </fieldset>

      {(errors.status || state?.error) && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-xs text-danger">{errors.status ?? state?.error}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" name="status" value="published" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          {published ? t("Simpan & tetap terbit") : t("Terbitkan")}
        </Button>
        <Button type="submit" name="status" value="draft" variant="outline" disabled={pending}>
          <Save /> {published ? t("Tarik ke draf") : t("Simpan sebagai draf")}
        </Button>
        <Button href={article ? `/artikel/${article.id}` : "/artikel"} variant="ghost">{t("Batal")}</Button>
      </div>
    </form>
  );
}
