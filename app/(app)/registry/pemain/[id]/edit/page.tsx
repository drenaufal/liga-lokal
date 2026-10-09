import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { getPlayer, getRegistryFilters } from "@/lib/queries/registry";
import { getMediaMeta } from "@/lib/media-store";
import { PLAYER_DOCUMENTS } from "@/lib/player-documents";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerForm } from "../../player-form";

export const metadata: Metadata = { title: "Ubah Data Pemain" };
export const dynamic = "force-dynamic";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("registry:write");
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();
  const [{ clubs, ageCategories }, ...metas] = await Promise.all([
    getRegistryFilters(),
    ...PLAYER_DOCUMENTS.map((d) => getMediaMeta(player[d.key])),
  ]);
  const docMeta = Object.fromEntries(PLAYER_DOCUMENTS.map((d, i) => [d.key, metas[i]]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/registry/pemain/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali ke profil
      </Link>
      <h1 className="text-lg font-semibold tracking-tight text-ink">Ubah Data Pemain</h1>
      <p className="mt-1 text-sm text-ink-muted">
        <span className="font-mono">{player.registrationNo}</span> · {player.fullName}. Perubahan
        tercatat pada jejak audit.
      </p>
      <Card className="mt-5">
        <CardContent>
          <PlayerForm
            clubs={clubs}
            ageCategories={ageCategories}
            player={player}
            docMeta={docMeta}
          />
        </CardContent>
      </Card>
    </div>
  );
}
