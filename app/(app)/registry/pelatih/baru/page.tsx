import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getRegistryFilters } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { CoachForm } from "../coach-form";

export const metadata: Metadata = { title: "Registrasi Pelatih Baru" };

export default async function NewCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  await requireCapability("registry:write");
  const [{ clubs }, { club }] = await Promise.all([getRegistryFilters(), searchParams]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={club ? `/registry/klub/${club}` : "/registry/pelatih"}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Registrasi Pelatih Baru</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Unggah lisensi kepelatihan dan KTP. Perubahan tercatat pada jejak audit.
      </p>
      <Card className="mt-5">
        <CardContent>
          <CoachForm clubs={clubs} defaultClubId={clubs.some((c) => c.id === club) ? club : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
