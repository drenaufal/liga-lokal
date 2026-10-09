"use client";

import * as React from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { rethrowControlFlow } from "@/lib/action-helpers";
import { formatNumber } from "@/lib/utils";
import { deleteTournament } from "./actions";

export type TournamentImpact = {
  teams: number;
  matches: number;
  completed: number;
  live: number;
  confirmed: number;
  events: number;
  players: number;
};

/**
 * "Hapus turnamen": spells out what goes with it and asks for the tournament's
 * name before anything is deleted. Blocked while a match is in play.
 */
export function DeleteTournament({
  tournamentId,
  name,
  impact,
}: {
  tournamentId: string;
  name: string;
  impact: TournamentImpact;
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, start] = React.useTransition();
  const matches = typed.trim() === name;
  const blocked = impact.live > 0;

  const submit = () => {
    const fd = new FormData();
    fd.set("id", tournamentId);
    fd.set("confirm", typed);
    start(async () => {
      try {
        await deleteTournament(fd); // redirects to the list when done
      } catch (e) {
        rethrowControlFlow(e);
        toast.error("Gagal menghapus turnamen", e instanceof Error ? e.message : undefined);
      }
    });
  };

  const items: [string, number][] = [
    ["tim peserta beserta skuad turnamen", impact.teams],
    ["pertandingan", impact.matches],
    ["kejadian pertandingan", impact.events],
  ];

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Hapus turnamen
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setTyped("");
        }}
      >
        <DialogContent
          title="Hapus turnamen ini?"
          description="Tindakan ini permanen dan tidak dapat dibatalkan."
          className="max-w-md"
        >
          <div className="space-y-4">
            <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm font-semibold text-ink">{name}</p>

            <ul className="space-y-1.5 text-xs text-ink-secondary">
              {items.map(([label, n]) => (
                <li key={label} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1.5">
                  <span>{label[0].toUpperCase() + label.slice(1)}</span>
                  <span className="font-semibold tabular-nums text-ink">{formatNumber(n)}</span>
                </li>
              ))}
              <li className="pt-0.5 text-ink-muted">
                {impact.confirmed > 0
                  ? `${impact.confirmed} hasil sudah dikonfirmasi — gol, assist, kartu, dll. dari turnamen ini dikurangkan dari total karier ${formatNumber(impact.players)} pemain.`
                  : `Klasemen, lencana, dan laporan AI turnamen ini ikut terhapus.`}
              </li>
            </ul>

            {blocked ? (
              <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
                <TriangleAlert className="mt-px size-4 shrink-0" />
                Ada {impact.live} pertandingan yang sedang berlangsung. Akhiri pertandingan tersebut dahulu.
              </p>
            ) : (
              <div>
                <Label htmlFor="confirm-name">Ketik nama turnamen untuk konfirmasi</Label>
                <Input
                  id="confirm-name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={name}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={submit} disabled={pending || blocked || !matches}>
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
                Hapus permanen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
