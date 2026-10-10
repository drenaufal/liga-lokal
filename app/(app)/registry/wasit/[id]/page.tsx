import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, ScrollText, Pencil, Landmark } from "lucide-react";
import { getRefereeProfile } from "@/lib/queries/registry";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await getRefereeProfile(id);
  return { title: d?.referee.fullName ?? "Wasit" };
}

export default async function RefereeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getRefereeProfile(id);
  if (!d) notFound();
  const { referee: r, assignments } = d;
  const user = await getCurrentUser();
  const canWrite = can(user?.role, "registry:write");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/registry/wasit"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={r.photoUrl} name={r.fullName} size={72} className="border border-line" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-ink">{r.fullName}</h1>
              <Badge tone="violet">{r.licenseLevel}</Badge>
              <StatusBadge kind="referee" value={r.status} dot />
              {canWrite && (
                <Button variant="outline" size="sm" href={`/registry/wasit/${r.id}/edit`} className="ml-auto">
                  <Pencil className="size-3.5" /> Ubah data
                </Button>
              )}
            </div>
            {r.specialty && <p className="mt-0.5 text-xs text-ink-muted">{r.specialty}</p>}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-secondary">
              <span className="flex items-center gap-1"><ScrollText className="size-3" /> {r.licenseNumber}</span>
              {r.askot && <span className="flex items-center gap-1"><Landmark className="size-3" /> Asal {r.askot}</span>}
              {r.city && <span className="flex items-center gap-1"><MapPin className="size-3" /> {r.city}</span>}
              {r.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {r.email}</span>}
              {r.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {r.phone}</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <Info label="Diterbitkan">{r.licenseIssuedAt ? formatDate(r.licenseIssuedAt) : "—"}</Info>
              <Info label="Berlaku s.d.">{r.licenseExpiry ? formatDate(r.licenseExpiry) : "—"}</Info>
              <Info label="Total memimpin">{r.matchesOfficiated} laga</Info>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penugasan Pertandingan</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length ? (
            <ul className="divide-y divide-line-soft">
              {assignments.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/match-ops/${m.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{m.homeShort} v {m.awayShort}</span>
                      <span className="text-[11px] text-ink-muted">{m.tournament}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {m.status === "completed" ? (
                        <span className="font-mono font-semibold text-ink">
                          {m.homeScore}–{m.awayScore}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-muted">{formatDate(m.scheduledAt)}</span>
                      )}
                      <StatusBadge kind="match" value={m.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs text-ink-muted">Belum ada penugasan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-2/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-0.5 text-ink-secondary">{children}</div>
    </div>
  );
}
