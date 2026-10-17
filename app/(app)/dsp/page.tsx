import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { CheckCircle2 } from "lucide-react";
import { requireCapability } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { ageCategories, clubs, coaches, competitions, matchDspSubmissions, matchLineups, matches, tournaments } from "@/lib/db/schema";
import { getEligibleMatchPlayers } from "@/lib/queries/match-roster";
import { PageHeader } from "@/components/app/page-header";
import { FilterSelect } from "@/components/app/list-controls";
import { ClubCrest } from "@/components/app/club-crest";
import { EmptyState } from "@/components/ui/misc";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { cn, formatDateTime } from "@/lib/utils";
import { DspForm, type DspCoach } from "./dsp-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daftar Susunan Pemain" };

export default async function DspPage({ searchParams }: { searchParams: Promise<{ ku?: string; match?: string; club?: string }> }) {
  const actor = await requireCapability("dsp:view");
  const sp = await searchParams;
  // Whoever may fill any club ("dsp:any-club") manages either side of any match; everyone else fills their own club.
  const isAdmin = can(actor, "dsp:any-club");
  const canSubmit = can(actor, "dsp:submit");
  if (!isAdmin && !actor.clubId) return <EmptyState title="Klub pelatih belum diatur" description="Admin perlu menghubungkan akun pelatih dengan SSB pada profil pelatih." />;
  const H = alias(clubs, "dsp_home"), A = alias(clubs, "dsp_away");
  const ownClub = isAdmin ? null : actor.clubId!;
  const hasDsp = ownClub
    ? and(eq(matchDspSubmissions.matchId, matches.id), eq(matchDspSubmissions.clubId, ownClub))
    : eq(matchDspSubmissions.matchId, matches.id);
  const rows = await db.select({ match: matches, competition: competitions.name, age: ageCategories.code, home: H.name, away: A.name, homeShort: H.shortName, awayShort: A.shortName, homeLogo: H.logoUrl, awayLogo: A.logoUrl })
    .from(matches).innerJoin(tournaments, eq(tournaments.id, matches.tournamentId)).innerJoin(competitions, eq(competitions.id, tournaments.competitionId))
    .leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).leftJoin(H, eq(H.id, matches.homeClubId)).leftJoin(A, eq(A.id, matches.awayClubId))
    .where(and(
      ownClub ? or(eq(matches.homeClubId, ownClub), eq(matches.awayClubId, ownClub)) : and(isNotNull(matches.homeClubId), isNotNull(matches.awayClubId)),
      or(eq(matches.status, "scheduled"), sql`exists (select 1 from ${matchDspSubmissions} where ${hasDsp})`),
    )).orderBy(asc(matches.scheduledAt));
  const kus = [...new Map(rows.map((r) => [r.match.tournamentId, { value: r.match.tournamentId, label: `${r.competition} · ${r.age ?? "KU"}` }])).values()];
  const fixtures = rows.filter((r) => r.match.tournamentId === sp.ku);
  const chosen = fixtures.find((r) => r.match.id === sp.match);

  const sides = chosen ? [
    { id: chosen.match.homeClubId!, name: chosen.home ?? "Tuan rumah", short: chosen.homeShort, logo: chosen.homeLogo, label: "Tuan rumah" },
    { id: chosen.match.awayClubId!, name: chosen.away ?? "Tamu", short: chosen.awayShort, logo: chosen.awayLogo, label: "Tamu" },
  ] : [];
  const clubId = ownClub ?? sides.find((s) => s.id === sp.club)?.id ?? null;
  const side = sides.find((s) => s.id === clubId);
  const submissions = isAdmin && chosen ? await db.select({ clubId: matchDspSubmissions.clubId }).from(matchDspSubmissions).where(eq(matchDspSubmissions.matchId, chosen.match.id)) : [];

  const detail = chosen && clubId ? await Promise.all([
    getEligibleMatchPlayers(chosen.match.tournamentId, [clubId]),
    db.select().from(matchLineups).where(and(eq(matchLineups.matchId, chosen.match.id), eq(matchLineups.clubId, clubId))),
    db.select().from(matchDspSubmissions).where(and(eq(matchDspSubmissions.matchId, chosen.match.id), eq(matchDspSubmissions.clubId, clubId))),
    db.select({ rules: ageCategories.rules }).from(tournaments).leftJoin(ageCategories, eq(ageCategories.id, tournaments.ageCategoryId)).where(eq(tournaments.id, chosen.match.tournamentId)),
    isAdmin
      ? db.select().from(coaches).where(eq(coaches.clubId, clubId)).orderBy(asc(coaches.fullName))
      : db.select().from(coaches).where(eq(coaches.userId, actor.id)),
  ]) : null;

  let coach: DspCoach | null = null;
  if (detail) {
    const submittedBy = detail[2][0]?.coachName ?? "";
    if (!isAdmin) {
      const own = detail[4][0];
      coach = { kind: "self", name: own?.fullName ?? actor.name ?? "Pelatih", photo: own?.photoUrl, detail: own ? [own.specialty, own.licenseLevel && `Lisensi ${own.licenseLevel}`].filter(Boolean).join(" · ") : null };
    } else {
      const options = detail[4].map((c) => ({ id: c.id, name: c.fullName, photo: c.photoUrl, subtitle: [c.specialty, c.licenseLevel && `Lisensi ${c.licenseLevel}`].filter(Boolean).join(" · ") || undefined }));
      const previous = options.find((o) => o.name === submittedBy);
      coach = { kind: "pick", options, initialId: previous?.id ?? (options.length === 1 ? options[0].id : null), fallbackName: submittedBy };
    }
  }

  const [club] = clubId ? await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, clubId)) : [];
  const description = isAdmin ? "Pilih KU, pertandingan, lalu SSB. Sebagai admin Anda juga memilih pelatih penanggung jawab." : `Pilih KU, pertandingan, lalu susunan pemain ${club?.name ?? "klub Anda"}.`;
  return <div className="space-y-4"><AutoRefresh seconds={10} /><PageHeader title="Daftar Susunan Pemain (DSP)" description={description} />
    <div className="flex flex-wrap gap-3"><FilterSelect param="ku" placeholder="1. Pilih KU" options={kus} resets={["match", "club"]} />
      {sp.ku && <FilterSelect param="match" placeholder="2. Pilih pertandingan" resets={["club"]} options={fixtures.map((r) => ({ value: r.match.id, label: `${r.home ?? "TBD"} vs ${r.away ?? "TBD"} · ${formatDateTime(r.match.scheduledAt)}${r.match.status !== "scheduled" ? " · Terkunci" : ""}` }))} />}</div>
    {isAdmin && chosen && <div role="group" aria-label="Pilih SSB" className="grid gap-2 sm:grid-cols-2">
      {sides.map((s) => {
        const done = submissions.some((x) => x.clubId === s.id);
        const active = s.id === clubId;
        return <Link key={s.id} href={`/dsp?ku=${chosen.match.tournamentId}&match=${chosen.match.id}&club=${s.id}`} scroll={false} aria-current={active ? "true" : undefined}
          className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors", active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}>
          <ClubCrest logoUrl={s.logo} short={s.short} size={36} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-ink">{s.name}</span><span className="block text-[11px] text-ink-muted">{s.label}</span></span>
          {done ? <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success"><CheckCircle2 className="size-3" /> DSP masuk</span>
            : <span className="rounded-full bg-warn/15 px-2.5 py-1 text-[11px] font-semibold text-warn">Belum submit</span>}
        </Link>;
      })}
    </div>}
    {chosen && detail && coach && side ? <DspForm key={`${chosen.match.id}:${clubId}`} matchId={chosen.match.id} clubId={isAdmin ? clubId! : undefined} clubName={club?.name ?? side.name} coach={coach}
      players={detail[0]} initial={detail[1].map((p) => ({ playerId: p.playerId, role: p.role }))}
      submission={detail[2][0] ? { coachName: detail[2][0].coachName, submittedAt: detail[2][0].submittedAt.toISOString() } : null}
      locked={!canSubmit || chosen.match.status !== "scheduled" || chosen.match.period !== "not_started"} rules={detail[3][0]?.rules} />
      : chosen && isAdmin ? <EmptyState title="Pilih SSB untuk mengisi DSP" description="Pilih tuan rumah atau tamu di atas, lalu pilih pelatih penanggung jawabnya." />
      : <EmptyState title={kus.length ? "Pilih pertandingan untuk mengisi DSP" : isAdmin ? "Belum ada pertandingan terjadwal" : "Belum ada jadwal untuk klub Anda"} description="DSP berisi pemain klub sesuai KU pertandingan." />}
  </div>;
}
