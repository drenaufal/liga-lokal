import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getClub } from "@/lib/queries/registry";
import { Card, CardContent } from "@/components/ui/card";
import { ClubForm } from "../../club-form";

export const metadata: Metadata = { title: "Ubah Data SSB" };
export const dynamic = "force-dynamic";

export default async function EditClubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("registry:write");
  const { id } = await params;
  const club = await getClub(id);
  if (!club) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/registry/klub/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke profil SSB
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Ubah Data SSB</h1>
      <p className="mt-1 text-sm text-ink-muted">{club.name}. Perubahan tercatat pada jejak audit.</p>
      <Card className="mt-5">
        <CardContent>
          <ClubForm club={club} />
        </CardContent>
      </Card>
    </div>
  );
}
