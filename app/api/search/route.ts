import { NextResponse } from "next/server";
import { and, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, coaches, competitions, players, referees, venues } from "@/lib/db/schema";
import { getClubScope, getCurrentUser } from "@/lib/auth/session";
import { clubScopeFilter, coachScopeFilter, playerScopeFilter } from "@/lib/club-scope";
import { can } from "@/lib/auth/rbac";
import { getT } from "@/lib/i18n/server";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const t = await getT();
  // Capped, and LIKE wildcards in the input are escaped so "%" / "_" match literally.
  const q = (new URL(req.url).searchParams.get("q")?.trim() ?? "").slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  // Each kind of result is only searched for people who may open its menu, and only within their SSB.
  const scope = await getClubScope();
  const none = Promise.resolve([] as never[]);
  const [pl, cl, rf, co, tn, vn] = await Promise.all([
    can(user, "registry.player:view")
      ? db
          .select({ id: players.id, name: players.fullName, reg: players.registrationNo })
          .from(players)
          .where(
            and(
              or(
                like(players.fullName, pattern),
                like(players.registrationNo, pattern),
                like(players.nisn, pattern),
              ),
              playerScopeFilter(scope),
            ),
          )
          .limit(6)
      : none,
    can(user, "registry.club:view")
      ? db
          .select({ id: clubs.id, name: clubs.name, short: clubs.shortName })
          .from(clubs)
          .where(and(or(like(clubs.name, pattern), like(clubs.shortName, pattern)), clubScopeFilter(clubs.id, scope)))
          .limit(4)
      : none,
    can(user, "registry.referee:view")
      ? db
          .select({ id: referees.id, name: referees.fullName })
          .from(referees)
          .where(like(referees.fullName, pattern))
          .limit(3)
      : none,
    can(user, "registry.coach:view")
      ? db
          .select({ id: coaches.id, name: coaches.fullName, level: coaches.licenseLevel })
          .from(coaches)
          .where(and(or(like(coaches.fullName, pattern), like(coaches.licenseNumber, pattern)), coachScopeFilter(scope)))
          .limit(3)
      : none,
    can(user, "competition:view")
      ? db
          .select({ id: competitions.id, name: competitions.name, season: competitions.season })
          .from(competitions)
          .where(or(like(competitions.name, pattern), like(competitions.organizer, pattern)))
          .limit(4)
      : none,
    can(user, "registry.venue:view")
      ? db
          .select({ id: venues.id, name: venues.name })
          .from(venues)
          .where(like(venues.name, pattern))
          .limit(3)
      : none,
  ]);

  const results = [
    ...pl.map((r) => ({
      type: t("Pemain::jenis"),
      label: r.name,
      sub: r.reg,
      href: `/registry/pemain/${r.id}`,
    })),
    ...cl.map((r) => ({
      type: t("Klub"),
      label: r.name,
      sub: r.short,
      href: `/registry/klub/${r.id}`,
    })),
    ...tn.map((r) => ({
      type: t("Turnamen"),
      label: r.name,
      sub: t("Musim {season}", { season: r.season }),
      href: `/kompetisi/${r.id}`,
    })),
    ...rf.map((r) => ({
      type: t("Wasit::jenis"),
      label: r.name,
      sub: "",
      href: `/registry/wasit/${r.id}`,
    })),
    ...co.map((r) => ({
      type: t("Pelatih::jenis"),
      label: r.name,
      sub: r.level,
      href: `/registry/pelatih/${r.id}`,
    })),
    ...vn.map((r) => ({
      type: t("Venue::jenis"),
      label: r.name,
      sub: "",
      href: `/registry/venue/${r.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
