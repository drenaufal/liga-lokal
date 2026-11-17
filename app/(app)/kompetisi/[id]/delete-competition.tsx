"use client";

import { TypedDeleteDialog } from "../typed-delete-dialog";
import { deleteCompetition } from "../actions";
import { useI18n } from "@/lib/i18n/client";

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
 * t("Hapus turnamen"): spells out what goes with it (every KU inside) and asks
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
  const { t } = useI18n();
  return (
    <TypedDeleteDialog
      triggerLabel={t("Hapus turnamen")}
      title={t("Hapus turnamen ini?")}
      name={name}
      confirmText={name}
      confirmLabel={t("Ketik nama turnamen untuk konfirmasi")}
      items={[
        [t("KU di dalam turnamen"), impact.kus],
        [t("SSB peserta (semua KU)"), impact.teams],
        [t("pertandingan"), impact.matches],
        [t("kejadian pertandingan"), impact.events],
      ]}
      note={
        impact.confirmed > 0
          ? t("{n} hasil sudah dikonfirmasi — gol, assist, kartu, dll. dari turnamen ini dikurangkan dari total karier {players} pemain.", { n: impact.confirmed, players: impact.players })
          : t("Klasemen, lencana, dan laporan AI turnamen ini ikut terhapus.")
      }
      blockedReason={
        impact.live > 0
          ? t("Ada {n} pertandingan yang sedang berlangsung. Akhiri pertandingan tersebut dahulu.", { n: impact.live })
          : null
      }
      errorTitle={t("Gagal menghapus turnamen")}
      onDelete={(typed) => {
        const fd = new FormData();
        fd.set("id", competitionId);
        fd.set("confirm", typed);
        return deleteCompetition(fd); // redirects to the list when done
      }}
    />
  );
}
