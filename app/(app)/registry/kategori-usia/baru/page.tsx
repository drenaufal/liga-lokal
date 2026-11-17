import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { listAgeCategories } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "../category-form";
import { MAX_CATEGORY_AGE, type CategoryDefaults } from "../shared";
import { getT } from "@/lib/i18n/server";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Kategori Usia Baru") };
}
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const t = await getT();
  await requireCapability("registry.category:create");
  const cats = await listAgeCategories();

  // Suggest the next two-year band above the oldest existing category (capped
  // at U-20). Once the cap is reached there is no natural "next" band, so the
  // code is left for the user to choose.
  const oldest = cats.reduce((m, c) => Math.max(m, c.category.maxAge), 0);
  const capped = oldest >= MAX_CATEGORY_AGE;
  const maxAge = Math.min(MAX_CATEGORY_AGE, oldest ? oldest + 2 : 8);
  const defaults: CategoryDefaults = {
    code: capped ? "" : `KU-${maxAge}`,
    label: capped ? "" : t("Kelompok Umur {n}", { n: maxAge }),
    maxAge,
    halfDuration: maxAge >= 17 ? 45 : 40,
    playersOnField: 11,
    maxSquad: maxAge >= 17 ? 23 : 20,
    ballSize: 5,
    substitutions: t("Maksimal 5 pemain (3 kesempatan)"),
    fieldType: t("Lapangan penuh"),
    notes: t("Aturan pertandingan mengikuti Laws of the Game"),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/kategori-usia"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("Tambah Kategori Usia")}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Buat kelompok umur baru hingga usia {max} tahun beserta aturan pertandingannya.", { max: MAX_CATEGORY_AGE })}
      </p>
      <Card className="mt-5">
        <CardContent>
          <CategoryForm defaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}
