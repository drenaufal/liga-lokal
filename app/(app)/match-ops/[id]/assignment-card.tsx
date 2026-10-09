"use client";

import * as React from "react";
import { CheckCircle2, Flag, Loader2, Save, TriangleAlert, UserCog } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { assignOfficials } from "./actions";

type Person = { id: string; name: string };

export type OfficialOptions = {
  referees: { id: string; name: string; level: string; city: string | null }[];
  operators: { id: string; name: string; role: string }[];
};

/**
 * Who referees and who runs the console. Both must be set before kick-off;
 * the choice is locked once the match starts.
 */
export function AssignmentCard({
  matchId,
  referee,
  operator,
  options,
  scheduled,
}: {
  matchId: string;
  referee: Person | null;
  operator: Person | null;
  /** Present only when the viewer may change the assignment. */
  options: OfficialOptions | null;
  scheduled: boolean;
}) {
  const [pending, start] = React.useTransition();
  const [refereeId, setRefereeId] = React.useState(referee?.id ?? "");
  const [operatorId, setOperatorId] = React.useState(operator?.id ?? "");
  const complete = !!(referee && operator);
  const editable = scheduled && !!options;
  const dirty = refereeId !== (referee?.id ?? "") || operatorId !== (operator?.id ?? "");

  const save = () => {
    const fd = new FormData();
    fd.set("matchId", matchId);
    fd.set("refereeId", refereeId);
    fd.set("operatorId", operatorId);
    start(async () => {
      try {
        const r = await assignOfficials(fd);
        toast.success("Penugasan disimpan");
        if (r.warnings.length) toast.warn("Periksa jadwal petugas", r.warnings.join(" · "));
      } catch (e) {
        toast.error("Gagal menyimpan penugasan", e instanceof Error ? e.message : undefined);
      }
    });
  };

  // a referee assigned earlier whose license has since lapsed must still show up
  const refereeOptions = options
    ? options.referees.some((r) => r.id === referee?.id) || !referee
      ? options.referees
      : [{ id: referee.id, name: referee.name, level: "lisensi tidak berlaku", city: null }, ...options.referees]
    : [];

  return (
    <Card id="penugasan" className="scroll-mt-24">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4" /> Penugasan Petugas
          </CardTitle>
          <CardDescription className="mt-1">
            {scheduled
              ? "Wasit dan operator wajib ditugaskan sebelum pertandingan bisa dimulai."
              : "Penugasan terkunci setelah pertandingan dimulai."}
          </CardDescription>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
            complete ? "bg-success/12 text-success" : "bg-warn/15 text-warn",
          )}
        >
          {complete ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
          {complete ? "Lengkap" : "Belum lengkap"}
        </span>
      </CardHeader>
      <CardContent>
        {editable ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assign-referee">
                  <Flag className="mr-1 inline size-3" /> Wasit
                </Label>
                <Select id="assign-referee" value={refereeId} onChange={(e) => setRefereeId(e.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {refereeOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.level}
                      {r.city ? ` · ${r.city}` : ""}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-ink-muted">Hanya wasit dengan lisensi yang masih berlaku.</p>
              </div>
              <div>
                <Label htmlFor="assign-operator">
                  <UserCog className="mr-1 inline size-3" /> Operator konsol
                </Label>
                <Select id="assign-operator" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
                  <option value="">Belum ditugaskan</option>
                  {options!.operators.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.role === "admin" ? " · admin" : ""}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-ink-muted">Yang mencatat kejadian selama pertandingan.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={save} disabled={pending || !dirty}>
                {pending ? <Loader2 className="animate-spin" /> : <Save className="size-3.5" />}
                Simpan penugasan
              </Button>
              {!dirty && complete && <span className="text-[11px] text-ink-muted">Tersimpan.</span>}
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row icon={Flag} label="Wasit" value={referee?.name} />
            <Row icon={UserCog} label="Operator konsol" value={operator?.name} />
          </dl>
        )}
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
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
        <I className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
        <dd className={cn("truncate text-sm font-semibold", value ? "text-ink" : "text-warn")}>
          {value ?? "Belum ditugaskan"}
        </dd>
      </div>
    </div>
  );
}
