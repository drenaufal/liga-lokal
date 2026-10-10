import Link from "next/link";
import { getBadgeGallery } from "@/lib/queries/intelligence";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/app/icon";
import { FilterSelect } from "@/components/app/list-controls";
import { EmptyState } from "@/components/ui/misc";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Badge gallery. Awards are earned inside a KU, so everything here is counted
 * per Turnamen and per KU — pick either (or both) to narrow it down.
 */
export default async function BadgeGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ turnamen?: string; ku?: string }>;
}) {
  const sp = await searchParams;
  const first = await getBadgeGallery({ competitionId: sp.turnamen });
  // a KU that is not part of the chosen Turnamen is ignored rather than showing an empty page
  const kuId = first.kus.some((k) => k.id === sp.ku) ? sp.ku : undefined;
  const gallery = kuId ? await getBadgeGallery({ competitionId: sp.turnamen, ageCategoryId: kuId }) : first;

  const competition = gallery.competitions.find((c) => c.id === sp.turnamen);
  const ku = gallery.kus.find((k) => k.id === kuId);
  const scope = [competition?.name, ku?.code].filter(Boolean).join(" · ");
  const filtered = !!competition || !!ku;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          param="turnamen"
          placeholder="Semua turnamen"
          resets={["ku"]}
          options={gallery.competitions.map((c) => ({ value: c.id, label: `${c.name} (${c.season})` }))}
        />
        <FilterSelect
          param="ku"
          placeholder="Semua KU"
          options={gallery.kus.map((k) => ({ value: k.id, label: k.code }))}
        />
        {filtered && (
          <Link href="/player-intelligence/badge" className="text-xs font-semibold text-brand hover:underline">
            Reset filter
          </Link>
        )}
      </div>

      <p className="mb-4 text-sm text-ink-muted">
        {gallery.badges.length} jenis lencana · {gallery.totalAwards} penghargaan
        {scope ? ` di ${scope}` : " di semua turnamen dan KU"}.
      </p>

      {gallery.totalAwards === 0 && filtered ? (
        <EmptyState
          title="Belum ada lencana di sini"
          description="Belum ada penghargaan untuk turnamen dan KU yang dipilih. Lencana muncul setelah pertandingan dimainkan."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gallery.badges.map((b) => (
            <Card key={b.id}>
              <CardContent>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-warn/25 bg-warn/10 text-warn">
                    <Icon name={b.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-ink">{b.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-muted">{b.description}</p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-semibold tabular-nums text-ink">{b.awards.length}</span>
                    <span className="text-[10px] text-ink-muted">penerima</span>
                  </span>
                </div>
                {b.awards.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line-soft pt-3">
                    {b.awards.slice(0, 4).map((a, i) => (
                      <li key={i}>
                        <Link
                          href={`/registry/pemain/${a.playerId}`}
                          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-2"
                        >
                          <span className="min-w-0 truncate text-ink-secondary">
                            {a.playerName}
                            <span className="text-ink-muted"> · {a.club}</span>
                            {/* where it was won — only needed when the list spans several KUs */}
                            {!ku && a.ageCode && <span className="text-ink-muted"> · {a.ageCode}</span>}
                            {!competition && a.competition && (
                              <span className="text-ink-muted"> · {a.competition}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[10px] text-ink-muted">{relativeTime(a.awardedAt)}</span>
                        </Link>
                      </li>
                    ))}
                    {b.awards.length > 4 && (
                      <li className="px-1.5 text-[10px] text-ink-muted">+{b.awards.length - 4} penerima lainnya</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
