import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, ScrollText, Pencil, Cake } from "lucide-react";
import { getCoachProfile } from "@/lib/queries/registry";
import { requireCapability, getClubScope } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getMediaMeta } from "@/lib/media-store";
import { COACH_DOCUMENTS, coachDocumentCompleteness } from "@/lib/coach-documents";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { StatusBadge } from "@/components/app/status-badge";
import { ClubCrest } from "@/components/app/club-crest";
import { DocumentRow } from "@/components/app/document-row";
import { ageFromDob } from "@/lib/utils";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CoachAccountCard } from "./account-card";
import { inClubScope } from "@/lib/club-scope";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getCoachProfile(id);
  const { t } = await getI18n();
  return { title: d?.coach.fullName ?? t("Pelatih::peran") };
}

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, fmt } = await getI18n();
  const user = await requireCapability("registry.coach:view");
  const { id } = await params;
  const d = await getCoachProfile(id);
  if (!d || !inClubScope(await getClubScope(), d.coach.clubId, d.coach.secondClubId)) notFound();
  const { coach: c, club, secondClub, recentMatches, squadSizes } = d;
  const canWrite = can(user, "registry.coach:edit");
  const canDocs = can(user, "registry:documents");
  const docMeta = canDocs
    ? await Promise.all(COACH_DOCUMENTS.map((doc) => getMediaMeta(c[doc.key])))
    : [];
  const completeness = coachDocumentCompleteness(c);
  const canManageAccount = can(user, "registry.coach:account");
  const account = canManageAccount && c.userId ? await db.query.users.findFirst({ where: eq(users.id, c.userId), columns: { email: true, active: true } }) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/registry/pelatih"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> {t("Kembali")}
      </Link>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={c.photoUrl} name={c.fullName} size={72} className="border border-line" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-ink">{c.fullName}</h1>
              <Badge tone="violet">{t.dyn(c.licenseLevel)}</Badge>
              {canWrite && (
                <Button variant="outline" size="sm" href={`/registry/pelatih/${c.id}/edit`} className="ml-auto">
                  <Pencil className="size-3.5" /> {t("Ubah data")}
                </Button>
              )}
            </div>
            {c.specialty && <p className="mt-0.5 text-xs text-ink-muted">{t.dyn(c.specialty)}</p>}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
              <span className="flex items-center gap-1"><ScrollText className="size-3" /> {c.licenseNumber}</span>
              {c.dob && (
                <span className="flex items-center gap-1"><Cake className="size-3" /> {t("{n} th", { n: ageFromDob(c.dob) })}</span>
              )}
              {c.city && <span className="flex items-center gap-1"><MapPin className="size-3" /> {c.city}</span>}
              {c.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {c.email}</span>}
              {c.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {c.phone}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {canManageAccount && <CoachAccountCard coachId={c.id} email={c.email ?? ""} account={account ?? null} hasClub={!!c.clubId} />}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("SSB Asuhan")}</CardTitle>
          </CardHeader>
          <CardContent>
            {club ? (
              <div className="space-y-2">
                {[club, secondClub].map((cl) => cl && (
                  <Link
                    key={cl.id}
                    href={`/registry/klub/${cl.id}`}
                    className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2/40 p-3 transition-colors hover:border-brand/30"
                  >
                    <ClubCrest logoUrl={cl.logoUrl} short={cl.shortName} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{cl.name}</span>
                      <span className="text-[11px] text-ink-muted">
                        {t("{city} · {n} pemain terdaftar", { city: cl.city, n: squadSizes[cl.id] ?? 0 })}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-ink-muted">{t("Belum terikat dengan SSB.")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Dokumen")}</CardTitle>
            <span className="text-[11px] tabular-nums text-ink-muted">
              {t("{have}/{total} lengkap", { have: completeness.have, total: completeness.total })}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={(completeness.have / completeness.total) * 100}
              tone={completeness.have === completeness.total ? "success" : "warn"}
            />
            <ul className="space-y-1.5">
              {COACH_DOCUMENTS.map((doc, i) => (
                <DocumentRow
                  key={doc.key}
                  label={t.dyn(doc.label)}
                  url={c[doc.key]}
                  meta={docMeta[i] ?? null}
                  canView={canDocs}
                  editHref={canWrite ? `/registry/pelatih/${c.id}/edit` : null}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {club && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Pertandingan SSB")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMatches.length ? (
              <ul className="divide-y divide-line-soft">
                {recentMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/match-ops/${m.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{m.homeShort} v {m.awayShort}</span>
                        <span className="text-[11px] text-ink-muted">{m.tournament}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-right">
                        {m.status === "completed" ? (
                          <span className="font-mono font-semibold text-ink">
                            {m.homeScore}–{m.awayScore}
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-muted">{fmt.date(m.scheduledAt)}</span>
                        )}
                        <StatusBadge kind="match" value={m.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-ink-muted">{t("Belum ada pertandingan.")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
