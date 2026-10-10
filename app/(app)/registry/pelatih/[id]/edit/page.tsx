import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getCoach, getRegistryFilters } from "@/lib/queries/registry";
import { getMediaMeta } from "@/lib/media-store";
import { COACH_DOCUMENTS } from "@/lib/coach-documents";
import { Card, CardContent } from "@/components/ui/card";
import { CoachForm } from "../../coach-form";

export const metadata: Metadata = { title: "Ubah Data Pelatih" };
export const dynamic = "force-dynamic";

export default async function EditCoachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("registry:write");
  const { id } = await params;
  const coach = await getCoach(id);
  if (!coach) notFound();
  const [{ clubs }, ...metas] = await Promise.all([
    getRegistryFilters(),
    ...COACH_DOCUMENTS.map((d) => getMediaMeta(coach[d.key])),
  ]);
  const docMeta = Object.fromEntries(COACH_DOCUMENTS.map((d, i) => [d.key, metas[i]]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/registry/pelatih/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke profil
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Ubah Data Pelatih</h1>
      <p className="mt-1 text-sm text-ink-muted">{coach.fullName}. Perubahan tercatat pada jejak audit.</p>
      <Card className="mt-5">
        <CardContent>
          <CoachForm clubs={clubs} coach={coach} docMeta={docMeta} />
        </CardContent>
      </Card>
    </div>
  );
}
