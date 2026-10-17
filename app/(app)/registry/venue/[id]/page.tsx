import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { venues } from "@/lib/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VENUE_SURFACE } from "@/lib/venue";
import { VenueCover } from "../venue-cover";
export const dynamic = "force-dynamic";
export default async function VenueDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability("registry.venue:view");
  const { id } = await params;
  const v = await db.query.venues.findFirst({ where: eq(venues.id, id) });
  if (!v) notFound();
  return <div className="mx-auto max-w-3xl">
    <Button href="/registry/venue" variant="ghost">← Semua venue</Button>
    <PageHeader title={v.name} description={[v.city, v.province].filter(Boolean).join(", ")} actions={can(user, "registry.venue:edit") ?<Button href={"/registry/venue/" + id + "/edit"}>Edit venue</Button> : undefined} />
    <Card><VenueCover photoUrl={v.photoUrl} name={v.name} surface={v.surface}>{null}</VenueCover><CardContent className="space-y-4 p-6">
      <dl className="grid gap-4 sm:grid-cols-2">{[
        ["Alamat", v.address || "—"], ["Permukaan", VENUE_SURFACE[v.surface]],
        ["Jumlah lapangan", v.fieldCount], ["Kapasitas", v.capacity ?? "Belum diketahui"],
        ["Lampu pertandingan", v.floodlights ? "Tersedia" : "Tidak tersedia"],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl>
      {v.notes && <div><h2 className="text-sm font-bold">Catatan fasilitas</h2><p className="mt-2 whitespace-pre-wrap text-sm">{v.notes}</p></div>}
    </CardContent></Card>
  </div>;
}
