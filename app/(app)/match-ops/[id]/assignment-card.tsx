"use client";

import * as React from "react";
import { CheckCircle2, Flag, Loader2, Save, TriangleAlert, UserCog } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PersonPicker, type PickerItem } from "@/components/app/person-picker";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { assignOfficials } from "./actions";
import { useI18n, useT } from "@/lib/i18n/client";

type Person = { id: string; name: string };

export type OfficialOptions = {
  referees: { id: string; name: string; level: string; city: string | null; license?: string; expiry?: string | null }[];
  operators: { id: string; name: string; role: string }[];
};

/**
 * One referee and one or more operators must be set before kick-off;
 * the choice is locked once the match starts.
 */
export function AssignmentCard({
  matchId,
  referee,
  operators,
  options,
  scheduled,
}: {
  matchId: string;
  referee: Person | null;
  operators: Person[];
  /** Present only when the viewer may change the assignment. */
  options: OfficialOptions | null;
  scheduled: boolean;
}) {
  const { t, fmt } = useI18n();
  const [pending, start] = React.useTransition();
  const [refereeId, setRefereeId] = React.useState(referee?.id ?? "");
  const [operatorIds, setOperatorIds] = React.useState(operators.map((o) => o.id));
  const complete = !!referee && operators.length > 0;
  const editable = scheduled && !!options;
  const dirty = refereeId !== (referee?.id ?? "") ||
    [...operatorIds].sort().join(":") !== operators.map((o) => o.id).sort().join(":");

  const save = () => {
    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("refereeId", refereeId);
    // Empty sentinel distinguishes "clear all" from the old single-operator form.
    fd.append("operatorIds", "");
    operatorIds.forEach((id) => fd.append("operatorIds", id));
    start(async () => {
      try {
        const r = await assignOfficials(fd);
        toast.success(t("Penugasan disimpan"));
        if (r.warnings.length) toast.warn(t("Periksa jadwal petugas"), r.warnings.join(" · "));
      } catch (e) {
        toast.error(t("Gagal menyimpan penugasan"), e instanceof Error ? e.message : undefined);
      }
    });
  };

  // a referee assigned earlier whose license has since lapsed must still show up
  const refereeItems: PickerItem[] = [
    ...(options?.referees ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      subtitle: [t("Lisensi {level}", { level: t.dyn(r.level) }), r.city, r.expiry ? t("s.d. {date}", { date: fmt.date(r.expiry) }) : null].filter(Boolean).join(" · "),    })),
    ...(referee && !options?.referees.some((r) => r.id === referee.id)
      ? [{ id: referee.id, name: referee.name, subtitle: t("Lisensi tidak berlaku"), badge: { label: t("Perlu diganti"), tone: "danger" as const } }]
      : []),
  ];
  const operatorItems: PickerItem[] = [
    ...(options?.operators ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      subtitle: o.role === "admin" ? t("Administrator") : t("Operator kompetisi"),
      badge: o.role === "admin" ? { label: t("Admin"), tone: "violet" as const } : undefined,
    })),
    ...operators.filter((o) => !options?.operators.some((option) => option.id === o.id))
      .map((o) => ({ id: o.id, name: o.name, unavailable: t("Tidak tersedia (nonaktif atau belum ditugaskan ke turnamen ini)") })),
  ];

  return (
    <Card id="penugasan" className="scroll-mt-24">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4" /> {t("Penugasan Petugas")}
          </CardTitle>
          <CardDescription className="mt-1">
            {scheduled
              ? t("Tugaskan wasit dan minimal satu operator sebelum pertandingan dimulai.")
              : t("Penugasan terkunci setelah pertandingan dimulai.")}
          </CardDescription>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
            complete ? "bg-success/12 text-success" : "bg-warn/15 text-warn",
          )}
        >
          {complete ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
          {complete ? t("Lengkap") : t("Belum lengkap")}
        </span>
      </CardHeader>
      <CardContent>
        {editable ? (
          <div className="space-y-4">
            <div className="grid gap-5 md:grid-cols-2">
              <PersonPicker
                mode="single"
                legend={t("Wasit::peran")}
                icon={<Flag className="size-3.5" />}
                items={refereeItems}
                value={refereeId ? [refereeId] : []}
                onChange={([id]) => setRefereeId(id ?? "")}
                disabled={pending}
                maxListHeight="h-64"
                noneLabel={t("Wasit belum ditugaskan")}
                placeholder={t("Cari nama wasit…")}
                emptyText={t("Belum ada wasit dengan lisensi berlaku.")}
                help={t("Hanya wasit dengan lisensi yang masih berlaku.")}
              />
              <PersonPicker
                mode="multi"
                legend={t("Operator konsol")}
                icon={<UserCog className="size-3.5" />}
                items={operatorItems}
                value={operatorIds}
                onChange={setOperatorIds}
                disabled={pending}
                maxListHeight="h-64"
                noneLabel={t("Operator belum ditugaskan")}
                placeholder={t("Cari nama operator…")}
                emptyText={t("Belum ada operator aktif.")}
                help={t("Pilih satu atau lebih operator pencatat. Hanya operator yang ditugaskan ke turnamen ini (Master Data → Operator) yang muncul.")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={save} disabled={pending || !dirty}>
                {pending ? <Loader2 className="animate-spin" /> : <Save className="size-3.5" />}
                {t("Simpan penugasan")}
              </Button>
              {dirty && <span className="text-[11px] font-medium text-warn">{t("Ada perubahan yang belum disimpan.")}</span>}
              {!dirty && complete && <span className="text-[11px] text-ink-muted">{t("Tersimpan.")}</span>}
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row icon={Flag} label={t("Wasit::peran")} value={referee?.name} />
            <Row icon={UserCog} label={t("Operator konsol ({n})", { n: operators.length })} value={operators.map((o) => o.name).join(", ") || null} />
          </dl>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
          {t("Semua operator dapat mencatat kedua tim. Sepakati pembagian tugas di luar sistem agar kejadian yang sama tidak dicatat dua kali.")}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  icon: I,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
        <I className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
        <dd className={cn("break-words text-sm font-semibold", value ? "text-ink" : "text-warn")}>
          {value ?? t("Belum ditugaskan")}
        </dd>
      </div>
    </div>
  );
}
