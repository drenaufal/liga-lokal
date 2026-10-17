import type { Metadata } from "next";
import { MapPin, Users, LayoutGrid, Lightbulb, Plus, CalendarDays } from "lucide-react";
import { listVenues } from "@/lib/queries/registry";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, StatCard } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchBox, FilterSelect } from "@/components/app/list-controls";
import { EmptyState } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";
import { VENUE_SURFACE } from "@/lib/venue";
import { VenueCover } from "./venue-cover";

export const metadata: Metadata = { title: "Registrasi Venue" };
export const dynamic = "force-dynamic";

export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ q?: string; surface?: string }> }) {
  const user = await requireCapability("registry.venue:view");
  const params = await searchParams;
  const rows = await listVenues(params);
  const canCreate = can(user, "registry.venue:create");
  const canWrite = can(user, "registry.venue:edit");
  const createButton = canCreate ?<Button href="/registry/venue/baru"><Plus />Tambah Venue</Button> : undefined;
  const capacityKnown = rows.some((v) => v.capacity != null);

  return (
    <div>
      <PageHeader title="Registrasi Venue" description="Temukan lapangan, lihat fasilitas, dan siapkan panggung untuk setiap pertandingan." actions={createButton} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Venue terdaftar" value={formatNumber(rows.length)} hint={params.q || params.surface ? "Sesuai filter yang dipilih" : "Lokasi pertandingan"} icon={<MapPin className="size-4" />} block="night" />
        <StatCard label="Lapangan tersedia" value={formatNumber(rows.reduce((total, v) => total + v.fieldCount, 0))} hint="Total lapangan pada venue yang tampil" icon={<LayoutGrid className="size-4" />} block="yellow" />
        <StatCard label="Kapasitas tercatat" value={capacityKnown ? formatNumber(rows.reduce((total, v) => total + (v.capacity ?? 0), 0)) : "—"} hint="Penonton pada venue yang tampil" icon={<Users className="size-4" />} />
      </div>
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <SearchBox placeholder="Cari venue atau kota…" />
          <FilterSelect param="surface" placeholder="Semua permukaan" options={Object.entries(VENUE_SURFACE).map(([value, label]) => ({ value, label }))} />
          <span className="text-[11px] text-ink-muted sm:ml-auto">{rows.length} venue ditampilkan</span>
        </div>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="Belum ada venue yang cocok" description="Sesuaikan pencarian atau daftarkan lokasi pertandingan baru." action={createButton} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => (
            <article key={v.id} aria-labelledby={`venue-${v.id}`} className="min-w-0 overflow-hidden rounded-3xl border border-line bg-surface">
              <VenueCover photoUrl={v.photoUrl} name={v.name} surface={v.surface}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-night px-3 py-1.5 text-[10px] font-bold text-white"><MapPin className="size-3" />Venue</span>
                <span className="rounded-full bg-surface px-3 py-1.5 text-[10px] font-semibold text-ink">{VENUE_SURFACE[v.surface]}</span>
              </VenueCover>
              <div className="p-5">
                <h2 id={`venue-${v.id}`} className="line-clamp-2 font-display text-2xl uppercase leading-tight">{v.name}</h2>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-secondary"><MapPin className="mt-0.5 size-3 shrink-0" />{[v.city, v.province].filter(Boolean).join(", ")}</p>
                {v.address && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">{v.address}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat icon={Users} label="Kapasitas" value={v.capacity == null ? "—" : formatNumber(v.capacity)} />
                  <Stat icon={LayoutGrid} label="Lapangan" value={formatNumber(v.fieldCount)} />
                  <Stat icon={Lightbulb} label="Lampu" value={v.floodlights ? "Tersedia" : "Tidak ada"} active={v.floodlights} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11px]">
                  <span className="flex items-center gap-1.5 text-ink-secondary"><CalendarDays className="size-3.5" /><strong className="text-ink">{formatNumber(Number(v.matches))}</strong> pertandingan</span>
                  <div className="flex gap-2"><Button href={"/registry/venue/" + v.id} size="sm" variant="ghost">Detail</Button>{canWrite && <Button href={"/registry/venue/" + v.id + "/edit"} size="sm" variant="outline">Edit</Button>}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, active }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; active?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl bg-surface-2 px-2.5 py-3", active && "bg-block-mint")}>
      <Icon className="mb-2 size-4 text-ink-secondary" />
      <span className="block text-[9px] font-medium text-ink-secondary">{label}</span>
      <span className="mt-0.5 block break-words text-xs font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}
