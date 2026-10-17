import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getAgeCategory } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "../../category-form";
import { toDefaults } from "../../shared";

export const metadata: Metadata = { title: "Ubah Kategori Usia" };
export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("registry.category:edit");
  const { id } = await params;
  const cat = await getAgeCategory(id);
  if (!cat) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/kategori-usia"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Ubah Kategori {cat.code}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Perubahan aturan berlaku untuk pemain dan kompetisi di kategori ini, dan tercatat pada jejak audit.
      </p>
      <Card className="mt-5">
        <CardContent>
          <CategoryForm categoryId={cat.id} defaults={toDefaults(cat)} />
        </CardContent>
      </Card>
    </div>
  );
}
