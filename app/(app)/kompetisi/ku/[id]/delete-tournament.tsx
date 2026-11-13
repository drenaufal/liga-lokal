"use client";

import { TypedDeleteDialog } from "../../typed-delete-dialog";
import { deleteTournament } from "./actions";
import { useI18n } from "@/lib/i18n/client";

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
 * t("Hapus KU"): spells out what goes with it and asks for the KU code before
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
  const { t } = useI18n();
  return (
    <TypedDeleteDialog
      triggerLabel={t("Hapus KU")}
      title={t("Hapus KU ini?")}
      name={label}
      confirmText={confirmText}
      confirmLabel={t("Ketik “{code}” untuk konfirmasi", { code: confirmText })}
      items={[
        [t("SSB peserta beserta skuad"), impact.teams],
        [t("pertandingan"), impact.matches],
        [t("kejadian pertandingan"), impact.events],
      ]}
      note={
        impact.confirmed > 0
          ? t("{n} hasil sudah dikonfirmasi — gol, assist, kartu, dll. dari KU ini dikurangkan dari total karier {players} pemain.", { n: impact.confirmed, players: impact.players })
          : t("Klasemen, lencana, dan laporan AI KU ini ikut terhapus.")
      }
      blockedReason={
        impact.live > 0
          ? t("Ada {n} pertandingan yang sedang berlangsung. Akhiri pertandingan tersebut dahulu.", { n: impact.live })
          : null
      }
      errorTitle={t("Gagal menghapus KU")}
      onDelete={(typed) => {
        const fd = new FormData();
        fd.set("id", tournamentId);
        fd.set("confirm", typed);
        return deleteTournament(fd); // redirects to the Turnamen when done
      }}
    />
  );
}
