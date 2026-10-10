"use client";

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { addTeam, removeTeam } from "./actions";

export type TeamOption = { id: string; name: string; short: string; players: number };

/** "Tambah SSB": pick an SSB that is not in the KU yet; the count shows how many players it has in this age group. */
export function AddTeam({
  kuId,
  options,
  ageCode,
}: {
  kuId: string;
  options: TeamOption[];
  ageCode: string | null;
}) {
  const [clubId, setClubId] = React.useState("");
  const [pending, start] = React.useTransition();

  const add = () =>
    start(async () => {
      try {
        await addTeam(kuId, clubId);
        const name = options.find((o) => o.id === clubId)?.name;
        toast.success("Peserta ditambahkan", name);
        setClubId("");
      } catch (e) {
        toast.error("Gagal menambah peserta", e instanceof Error ? e.message : undefined);
      }
    });

  if (options.length === 0) {
    return <p className="text-xs text-ink-muted">Semua SSB aktif sudah menjadi peserta KU ini.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={clubId}
        onChange={(e) => setClubId(e.target.value)}
        className="h-10 min-w-0 flex-1 rounded-full text-xs sm:max-w-sm"
        aria-label="Pilih SSB"
      >
        <option value="">Pilih SSB untuk ditambahkan…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {ageCode ? ` — ${o.players} pemain ${ageCode}` : ""}
          </option>
        ))}
      </Select>
      <Button size="sm" disabled={!clubId || pending} onClick={add}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus className="size-3.5" />}
        Tambah
      </Button>
    </div>
  );
}

/** Takes an SSB out of the KU — refused (with the reason) once it has matches in it. */
export function RemoveTeamButton({
  kuId,
  clubId,
  name,
  matchCount,
}: {
  kuId: string;
  clubId: string;
  name: string;
  matchCount: number;
}) {
  const [pending, start] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const blocked = matchCount > 0;

  const remove = () =>
    start(async () => {
      try {
        await removeTeam(kuId, clubId);
        toast.success("Peserta dikeluarkan", name);
      } catch (e) {
        toast.error("Gagal mengeluarkan peserta", e instanceof Error ? e.message : undefined);
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending || blocked}
        title={blocked ? `Sudah punya ${matchCount} pertandingan — hapus jadwalnya dahulu` : `Keluarkan ${name}`}
        aria-label={`Keluarkan ${name}`}
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Keluarkan peserta?"
        description={`${name} akan dikeluarkan dari peserta KU ini.`}
        confirmLabel="Keluarkan"
        onConfirm={remove}
      />
    </>
  );
}
