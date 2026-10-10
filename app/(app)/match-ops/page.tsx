import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Calendar, CheckCircle2, CircleDashed } from "lucide-react";
import { listMatches, type MatchListParams } from "@/lib/queries/match";
import { FilterSelect } from "@/components/app/list-controls";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { MatchRow, MatchStack } from "@/components/app/match-row";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Match Operations" };
export const dynamic = "force-dynamic";

const filters = [
  { value: "", label: "Semua pertandingan" },
  { value: "live", label: "Langsung" },
  { value: "scheduled", label: "Terjadwal" },
  { value: "completed", label: "Selesai" },
  { value: "postponed", label: "Ditunda" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default async function MatchOpsPage({ searchParams }: { searchParams: Promise<MatchListParams> }) {
  const params = await searchParams;
  const { rows, tournamentOpts } = await listMatches(params);
  const sections = [
    { status: "live", title: "Sedang berlangsung", icon: Radio },
    { status: "scheduled", title: "Pertandingan mendatang", icon: Calendar },
    { status: "completed", title: "Hasil pertandingan", icon: CheckCircle2 },
    { status: "postponed", title: "Ditunda", icon: CircleDashed },
    { status: "cancelled", title: "Dibatalkan", icon: CircleDashed },
  ];

  function filterHref(status: string) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && key !== "status" && key !== "page") next.set(key, value);
    }
    if (status) next.set("status", status);
    return `/match-ops${next.size ? `?${next}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AutoRefresh seconds={15} />
      <PageHeader title="Match Operations" description="Kendali pertandingan langsung dengan papan taktik visual, pencatatan kejadian, dan validasi hasil." />

      <div className="mb-8 space-y-3">
        <nav aria-label="Filter status pertandingan" className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <Link key={filter.value} href={filterHref(filter.value)} aria-current={(params.status ?? "") === filter.value ? "page" : undefined} className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand", (params.status ?? "") === filter.value ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-secondary hover:border-ink/30 hover:text-ink")}>
              {filter.value === "live" && <Radio className="size-3" />}{filter.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterSelect param="tournament" placeholder="Semua turnamen & KU" groups={Object.entries(tournamentOpts.reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
            (acc[t.competition] ??= []).push({ value: t.id, label: t.ageCode ?? "Tanpa KU" });
            return acc;
          }, {})).map(([label, options]) => ({ label, options }))} />
          <span className="text-[10px] font-medium text-ink-muted">{rows.length} pertandingan · Waktu dalam WIB</span>
        </div>
      </div>

      {sections.map(({ status, title, icon: Icon }) => {
        const matches = rows.filter((m) => m.status === status);
        if (!matches.length) return null;
        return (
          <section key={status} className="mb-8" aria-labelledby={`matches-${status}`}>
            <div className="mb-4 flex items-center gap-2.5">
              <Icon className={cn("size-4", status === "live" ? "animate-live text-brand" : "text-ink-secondary")} />
              <h2 id={`matches-${status}`} className="text-xs font-bold uppercase tracking-wider">{title}</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">{matches.length}</span>
              <span className="ml-2 h-px flex-1 bg-line" />
            </div>
            <MatchStack>
              {matches.map((m) => <MatchRow key={m.id} m={m} />)}
            </MatchStack>
          </section>
        );
      })}
      {rows.length === 0 && <EmptyState title="Tidak ada pertandingan" description="Sesuaikan filter di atas." />}
    </div>
  );
}
