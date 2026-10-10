import { NextResponse } from "next/server";
import { like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, coaches, competitions, players, referees, venues } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const pattern = `%${q}%`;

  const [pl, cl, rf, co, tn, vn] = await Promise.all([
    db
      .select({ id: players.id, name: players.fullName, reg: players.registrationNo })
      .from(players)
      .where(
        or(
          like(players.fullName, pattern),
          like(players.registrationNo, pattern),
          like(players.nisn, pattern),
        ),
      )
      .limit(6),
    db
      .select({ id: clubs.id, name: clubs.name, short: clubs.shortName })
      .from(clubs)
      .where(or(like(clubs.name, pattern), like(clubs.shortName, pattern)))
      .limit(4),
    db
      .select({ id: referees.id, name: referees.fullName })
      .from(referees)
      .where(like(referees.fullName, pattern))
      .limit(3),
    db
      .select({ id: coaches.id, name: coaches.fullName, level: coaches.licenseLevel })
      .from(coaches)
      .where(or(like(coaches.fullName, pattern), like(coaches.licenseNumber, pattern)))
      .limit(3),
    db
      .select({ id: competitions.id, name: competitions.name, season: competitions.season })
      .from(competitions)
      .where(or(like(competitions.name, pattern), like(competitions.organizer, pattern)))
      .limit(4),
    db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(like(venues.name, pattern))
      .limit(3),
  ]);

  const results = [
    ...pl.map((r) => ({
      type: "Pemain",
      label: r.name,
      sub: r.reg,
      href: `/registry/pemain/${r.id}`,
    })),
    ...cl.map((r) => ({
      type: "Klub",
      label: r.name,
      sub: r.short,
      href: `/registry/klub/${r.id}`,
    })),
    ...tn.map((r) => ({
      type: "Turnamen",
      label: r.name,
      sub: `Musim ${r.season}`,
      href: `/kompetisi/${r.id}`,
    })),
    ...rf.map((r) => ({
      type: "Wasit",
      label: r.name,
      sub: "",
      href: `/registry/wasit/${r.id}`,
    })),
    ...co.map((r) => ({
      type: "Pelatih",
      label: r.name,
      sub: r.level,
      href: `/registry/pelatih/${r.id}`,
    })),
    ...vn.map((r) => ({
      type: "Venue",
      label: r.name,
      sub: "",
      href: `/registry/venue/${r.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
