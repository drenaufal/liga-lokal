"use client";

import { formatNumber } from "@/lib/utils";
import { TypedDeleteDialog } from "../../typed-delete-dialog";
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
 * "Hapus KU": spells out what goes with it and asks for the KU code before
 * anything is deleted. Blocked while a match is in play.
 */
export function DeleteKu({
  tournamentId,
  label,
  confirmText,
  impact,
}: {
  tournamentId: string;
  /** Full name, "<turnamen> · KU-14". */
  label: string;
  /** What to type — the KU code. */
  confirmText: string;
  impact: TournamentImpact;
}) {
  return (
    <TypedDeleteDialog
      triggerLabel="Hapus KU"
      title="Hapus KU ini?"
      name={label}
      confirmText={confirmText}
      confirmLabel={`Ketik “${confirmText}” untuk konfirmasi`}
      items={[
        ["SSB peserta beserta skuad", impact.teams],
        ["pertandingan", impact.matches],
        ["kejadian pertandingan", impact.events],
      ]}
      note={
        impact.confirmed > 0
          ? `${impact.confirmed} hasil sudah dikonfirmasi — gol, assist, kartu, dll. dari KU ini dikurangkan dari total karier ${formatNumber(impact.players)} pemain.`
          : "Klasemen, lencana, dan laporan AI KU ini ikut terhapus."
      }
      blockedReason={
        impact.live > 0
          ? `Ada ${impact.live} pertandingan yang sedang berlangsung. Akhiri pertandingan tersebut dahulu.`
          : null
      }
      errorTitle="Gagal menghapus KU"
      onDelete={(typed) => {
        const fd = new FormData();
        fd.set("id", tournamentId);
        fd.set("confirm", typed);
        return deleteTournament(fd); // redirects to the Turnamen when done
      }}
    />
  );
}
