import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { listAgeCategories } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "../category-form";
import { MAX_CATEGORY_AGE, type CategoryDefaults } from "../shared";

export const metadata: Metadata = { title: "Kategori Usia Baru" };
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireCapability("registry:write");
  const cats = await listAgeCategories();

  // Suggest the next two-year band above the oldest existing category (capped
  // at U-20). Once the cap is reached there is no natural "next" band, so the
  // code is left for the user to choose.
  const oldest = cats.reduce((m, c) => Math.max(m, c.category.maxAge), 0);
  const capped = oldest >= MAX_CATEGORY_AGE;
  const maxAge = Math.min(MAX_CATEGORY_AGE, oldest ? oldest + 2 : 8);
  const defaults: CategoryDefaults = {
    code: capped ? "" : `KU-${maxAge}`,
    label: capped ? "" : `Kelompok Umur ${maxAge}`,
    maxAge,
    halfDuration: maxAge >= 17 ? 45 : 40,
    playersOnField: 11,
    maxSquad: maxAge >= 17 ? 23 : 20,
    ballSize: 5,
    substitutions: "Maksimal 5 pemain (3 kesempatan)",
    fieldType: "Lapangan penuh",
    notes: "Aturan pertandingan mengikuti Laws of the Game",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/kategori-usia"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Tambah Kategori Usia</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Buat kelompok umur baru hingga usia {MAX_CATEGORY_AGE} tahun beserta aturan pertandingannya.
      </p>
      <Card className="mt-5">
        <CardContent>
          <CategoryForm defaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}
