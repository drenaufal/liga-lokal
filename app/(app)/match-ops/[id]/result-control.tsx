"use client";

import * as React from "react";
import { CheckCircle2, PenLine, Loader2, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/app/status-badge";
import { toast } from "@/components/ui/toaster";
import { confirmResult, amendResult, setShootout, type CupOutcome } from "./actions";

export function ResultControl({
  matchId,
  resultStatus,
  homeScore,
  awayScore,
  canConfirm,
  amendmentReason,
  isCup = false,
  homeShort = null,
  awayShort = null,
  homePenalties = null,
  awayPenalties = null,
}: {
  matchId: string;
  resultStatus: string;
  homeScore: number;
  awayScore: number;
  canConfirm: boolean;
  amendmentReason: string | null;
  /** A Cup match: it needs a winner, so a level score goes to a shoot-out. */
  isCup?: boolean;
  homeShort?: string | null;
  awayShort?: string | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}) {
  const [pending, start] = React.useTransition();
  const [amending, setAmending] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [penHome, setPenHome] = React.useState(homePenalties != null ? String(homePenalties) : "");
  const [penAway, setPenAway] = React.useState(awayPenalties != null ? String(awayPenalties) : "");

  const level = homeScore === awayScore;
  const needsShootout = isCup && level;
  const hasShootout = homePenalties != null && awayPenalties != null && homePenalties !== awayPenalties;

  /** Tells the person where the winner went, or why it could not go anywhere. */
  const report = (title: string, outcome: CupOutcome) => {
    if (outcome.warning) toast.warn(title, outcome.warning);
    else if (outcome.advancedTo) toast.success(title, `Pemenang maju ke ${outcome.advancedTo}`);
    else toast.success(title, "Klasemen & statistik pemain diperbarui");
  };

  const doConfirm = () => {
    const fd = new FormData();
    fd.set("id", matchId);
    start(async () => {
      try {
        report("Hasil dikonfirmasi", await confirmResult(fd));
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  const doShootout = () => {
    start(async () => {
      try {
        const outcome = await setShootout({ matchId, home: Number(penHome), away: Number(penAway) });
        report("Skor adu penalti disimpan", outcome);
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  const doAmend = () => {
    if (!reason.trim()) {
      toast.error("Alasan koreksi wajib diisi");
      return;
    }
    const fd = new FormData();
    fd.set("id", matchId);
    fd.set("reason", reason);
    start(async () => {
      try {
        report("Hasil dikoreksi", await amendResult(fd));
        setAmending(false);
        setReason("");
      } catch (e) {
        toast.error("Gagal", e instanceof Error ? e.message : undefined);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" /> Validasi Hasil
        </CardTitle>
        <StatusBadge kind="result" value={resultStatus} dot />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-ink-secondary">
          Skor akhir: <span className="font-mono font-semibold text-ink">{homeScore} – {awayScore}</span>
          {isCup && level && hasShootout && (
            <span className="ml-1.5 text-ink-muted">
              (adu penalti {homePenalties}–{awayPenalties})
            </span>
          )}
        </p>
        {amendmentReason && (
          <p className="rounded-lg border border-violet/25 bg-violet/10 p-2.5 text-[11px] text-violet">
            Koreksi terakhir: {amendmentReason}
          </p>
        )}

        {needsShootout && canConfirm && (
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Target className="size-3.5 text-brand" /> Adu penalti
            </p>
            <p className="text-[11px] text-ink-muted">
              Pertandingan sistem gugur tidak boleh berakhir seri. Isi skor adu penalti — pemenangnya maju ke babak
              berikutnya.
            </p>
            <div className="flex items-center gap-2">
              <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {homeShort ?? "Tuan rumah"}
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={penHome}
                  onChange={(e) => setPenHome(e.target.value)}
                  className="mt-1 text-center font-mono"
                  aria-label={`Penalti ${homeShort ?? "tuan rumah"}`}
                />
              </label>
              <span className="pt-4 text-ink-muted">–</span>
              <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {awayShort ?? "Tamu"}
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={penAway}
                  onChange={(e) => setPenAway(e.target.value)}
                  className="mt-1 text-center font-mono"
                  aria-label={`Penalti ${awayShort ?? "tamu"}`}
                />
              </label>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending || penHome === "" || penAway === ""}
              onClick={doShootout}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Target className="size-3.5" />}
              Simpan skor penalti
            </Button>
          </div>
        )}

        {!canConfirm && (
          <p className="text-[11px] text-ink-muted">
            Konfirmasi hasil memerlukan peran Wasit atau Operator Kompetisi.
          </p>
        )}

        {canConfirm && (
          <div className="space-y-2">
            {resultStatus === "unconfirmed" && (
              <Button
                className="w-full"
                size="sm"
                disabled={pending || (needsShootout && !hasShootout)}
                onClick={doConfirm}
              >
                {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Konfirmasi Hasil
              </Button>
            )}
            {(resultStatus === "confirmed" || resultStatus === "amended") && !amending && (
              <Button
                className="w-full"
                size="sm"
                variant="outline"
                onClick={() => setAmending(true)}
              >
                <PenLine className="size-3.5" /> Koreksi Hasil
              </Button>
            )}
            {amending && (
              <div className="space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan koreksi (mis. gol salah dicatat, protes SSB disetujui)…"
                  className="text-xs"
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={pending} onClick={doAmend}>
                    {pending ? <Loader2 className="animate-spin" /> : <PenLine className="size-3.5" />}
                    Simpan Koreksi
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAmending(false)}>
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-[10px] text-ink-muted">
          Setiap konfirmasi & koreksi tercatat pada jejak audit menyeluruh.
        </p>
      </CardContent>
    </Card>
  );
}
