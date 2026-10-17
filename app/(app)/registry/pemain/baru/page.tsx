import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getRegistryFilters } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Registrasi Pemain Baru" };

export default async function NewPlayerPage() {
  await requireCapability("registry.player:create");
  const { clubs, ageCategories } = await getRegistryFilters();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/registry/pemain"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">
        Registrasi Pemain Baru
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Data pemain baru masuk dengan status <strong>Menunggu</strong> hingga diverifikasi operator.
      </p>
      <Card className="mt-5">
        <CardContent>
          <PlayerForm clubs={clubs} ageCategories={ageCategories} />
        </CardContent>
      </Card>
    </div>
  );
}
