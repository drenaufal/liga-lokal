import Link from "next/link";
import { getBadgeGallery, getPlayerFilterOptions, getManualBadgeOptions } from "@/lib/queries/intelligence";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ManualMvp } from "./manual-mvp";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/app/icon";
import { EmptyState } from "@/components/ui/misc";
import { relativeTime } from "@/lib/utils";
import { IntelligenceFilters, IntelligencePagination } from "../filters";
import { pagingFields, positionField, paramValue, type FilterField, type IntelligenceParams } from "@/lib/intelligence-filters";

export const dynamic = "force-dynamic";
export default async function BadgeGalleryPage({ searchParams }: { searchParams: Promise<IntelligenceParams> }) {
  const user = await requireCapability("intelligence.badge:view");
  const sp = await searchParams;
  const [gallery, options] = await Promise.all([getBadgeGallery(sp), getPlayerFilterOptions()]);
  const manualOptions = can(user, "intelligence.badge:select") ?await getManualBadgeOptions({ ...sp, ku: gallery.selectedKu }) : null;
  const competition = gallery.competitions.find((c) => c.id === paramValue(sp, "turnamen"));
  const ku = gallery.kus.find((k) => k.id === gallery.selectedKu);
  const scope = [competition?.name, ku?.code].filter(Boolean).join(" · ");
  const fields: FilterField[] = [
    { key: "q", label: "Cari pemain atau lencana", placeholder: "Nama pemain / nama lencana…" },
    { key: "badge", label: "Jenis lencana", placeholder: "Semua lencana", options: gallery.badgeOptions },
    { key: "earned", label: "Status penghargaan", placeholder: "Semua status", options: [{ value: "yes", label: "Ada penerima" }, { value: "no", label: "Belum ada penerima" }] },
    { key: "turnamen", label: "Turnamen", placeholder: "Semua turnamen", options: gallery.competitions.map((c) => ({ value: c.id, label: c.name + " (" + c.season + ")" })) },
    { key: "ku", label: "Kategori usia", placeholder: "Semua KU", options: gallery.kus.map((k) => ({ value: k.id, label: k.code })) },
    { key: "club", label: "SSB", placeholder: "Semua SSB", options: options.clubs.map((c) => ({ value: c.id, label: c.name })) },
    positionField,
    { key: "from", label: "Diberikan sejak", type: "date" },
    { key: "to", label: "Diberikan sampai", type: "date" },
    { key: "sort", label: "Urutkan lencana", defaultValue: "name", options: [{ value: "name", label: "Nama lencana" }, { value: "count", label: "Jumlah penghargaan" }, { value: "recent", label: "Tanggal penghargaan terbaru" }] },
    ...pagingFields.map((f) => f.key === "order" ? { ...f, defaultValue: "asc" } : f),
    { key: "awardSort", label: "Urutkan penerima", defaultValue: "recent", options: [{ value: "recent", label: "Terbaru dahulu" }, { value: "oldest", label: "Terlama dahulu" }, { value: "name", label: "Nama pemain A–Z" }] },
  ];
  const awardRow = (a: (typeof gallery.badges)[number]["awards"][number]) => <li key={a.id}>
    <Link href={"/registry/pemain/" + a.playerId} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-2">
      <span className="min-w-0 truncate text-ink-secondary">{a.playerName}<span className="text-ink-muted"> · {a.club}</span>
        {!ku && a.ageCode && <span className="text-ink-muted"> · {a.ageCode}</span>}
        {!competition && a.competition && <span className="text-ink-muted"> · {a.competition}</span>}
      </span><span className="shrink-0 text-right"><span className="block font-semibold tabular-nums text-ink">Skor {a.score.toFixed(2)}</span><span className="text-[10px] text-ink-muted">{relativeTime(a.awardedAt)}</span></span>
    </Link>
  </li>;
  return <div className="space-y-4">
    <IntelligenceFilters params={{ ...sp, ku: gallery.selectedKu }} fields={fields} title="Filter & pengurutan galeri lencana" />
    {manualOptions && <ManualMvp key={`${paramValue(sp, "turnamen")}:${gallery.selectedKu}`} options={manualOptions} />}
    <p className="text-xs text-ink-muted">Skor pemain mengikuti filter turnamen dan KU yang dipilih.</p>
    <p className="text-sm text-ink-muted">{gallery.total} jenis lencana · {gallery.totalAwards} penghargaan{scope ? " di " + scope : " di semua turnamen dan KU"}.</p>
    {!gallery.total ? <EmptyState title="Tidak ada lencana yang cocok" description="Sesuaikan pencarian, tanggal, atau filter penghargaan." /> :
      <div className="grid gap-4 md:grid-cols-2">{gallery.badges.map((b) => <Card key={b.id}><CardContent>
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-warn/25 bg-warn/10 text-warn"><Icon name={b.icon} className="size-5" /></span>
          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-ink">{b.name}</h3><p className="mt-0.5 text-xs text-ink-muted">{b.description}</p></div>
          <span className="shrink-0 text-right"><span className="block text-lg font-semibold tabular-nums text-ink">{b.awards.length}</span><span className="text-[10px] text-ink-muted">penghargaan</span></span>
        </div>
        {!!b.awards.length && <ul className="mt-3 space-y-1 border-t border-line-soft pt-3">{b.awards.slice(0, 4).map(awardRow)}</ul>}
        {b.awards.length > 4 && <details className="mt-2"><summary className="cursor-pointer px-1.5 text-xs font-semibold text-brand">Lihat {b.awards.length - 4} penghargaan lainnya</summary><ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">{b.awards.slice(4).map(awardRow)}</ul></details>}
      </CardContent></Card>)}</div>}
    <IntelligencePagination params={sp} total={gallery.total} page={gallery.page} pageSize={gallery.pageSize} label="lencana" />
  </div>;
}
