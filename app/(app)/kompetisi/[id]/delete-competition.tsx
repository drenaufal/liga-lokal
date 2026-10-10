"use client";

import { formatNumber } from "@/lib/utils";
import { TypedDeleteDialog } from "../typed-delete-dialog";
import { deleteCompetition } from "../actions";

export type CompetitionImpact = {
  kus: number;
  teams: number;
  matches: number;
  completed: number;
  live: number;
  confirmed: number;
  events: number;
  players: number;
};

/**
 * "Hapus turnamen": spells out what goes with it (every KU inside) and asks
 * for the Turnamen's name before anything is deleted. Blocked while a match is in play.
 */
export function DeleteCompetition({
  competitionId,
  name,
  impact,
}: {
  competitionId: string;
  name: string;
  impact: CompetitionImpact;
}) {
  return (
    <TypedDeleteDialog
      triggerLabel="Hapus turnamen"
      title="Hapus turnamen ini?"
      name={name}
      confirmText={name}
      confirmLabel="Ketik nama turnamen untuk konfirmasi"
      items={[
        ["KU di dalam turnamen", impact.kus],
        ["SSB peserta (semua KU)", impact.teams],
        ["pertandingan", impact.matches],
        ["kejadian pertandingan", impact.events],
      ]}
      note={
        impact.confirmed > 0
          ? `${impact.confirmed} hasil sudah dikonfirmasi — gol, assist, kartu, dll. dari turnamen ini dikurangkan dari total karier ${formatNumber(impact.players)} pemain.`
          : "Klasemen, lencana, dan laporan AI turnamen ini ikut terhapus."
      }
      blockedReason={
        impact.live > 0
          ? `Ada ${impact.live} pertandingan yang sedang berlangsung. Akhiri pertandingan tersebut dahulu.`
          : null
      }
      errorTitle="Gagal menghapus turnamen"
      onDelete={(typed) => {
        const fd = new FormData();
        fd.set("id", competitionId);
        fd.set("confirm", typed);
        return deleteCompetition(fd); // redirects to the list when done
      }}
    />
  );
}
