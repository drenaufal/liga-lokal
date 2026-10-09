import type { AiReportResult } from "@/lib/db/schema";
import { percentile } from "@/lib/scoring";
import { positionLine } from "@/lib/positions";

type PlayerCtx = {
  name: string;
  position: string;
  ageCode: string | null;
  club: string | null;
  appearances: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  interceptions: number;
  keyPasses: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  motm: number;
  score: number;
  rating: number;
};

type PeerStat = { score: number; goals: number; assists: number; saves: number };

const POS_LABEL: Record<string, string> = {
  GK: "kiper",
  DF: "pemain bertahan",
  MF: "gelandang",
  FW: "penyerang",
};

/** Data-driven player analysis — genuine (from real stats), just generated offline. */
export function demoPlayerAnalysis(p: PlayerCtx, peers: PeerStat[]): AiReportResult {
  const per90 = (n: number) => (p.minutesPlayed ? (n / p.minutesPlayed) * 90 : 0);
  const scorePct = percentile(p.score, peers.map((x) => x.score));
  const goalPct = percentile(p.goals, peers.map((x) => x.goals));
  const assistPct = percentile(p.assists, peers.map((x) => x.assists));

  const strengths: string[] = [];
  const growth: string[] = [];

  if (goalPct >= 70) strengths.push(`Produktivitas gol persentil ${goalPct} untuk ${POS_LABEL[positionLine(p.position)]} ${p.ageCode ?? ""}`.trim());
  if (assistPct >= 70) strengths.push(`Kreativitas (assist) persentil ${assistPct} — kontributor peluang utama`);
  if (per90(p.tackles + p.interceptions) >= 4) strengths.push(`Aktivitas defensif tinggi (${(per90(p.tackles + p.interceptions)).toFixed(1)} tekel+intersep / 90)`);
  if (p.position === "GK" && p.cleanSheets >= 2) strengths.push(`${p.cleanSheets} nirbobol dari ${p.appearances} penampilan`);
  if (p.yellowCards + p.redCards === 0 && p.appearances >= 4) strengths.push("Disiplin sangat baik — nihil kartu sepanjang kompetisi");
  if (p.motm > 0) strengths.push(`${p.motm}× terpilih sebagai Pemain Terbaik Pertandingan`);
  if (strengths.length === 0) strengths.push("Konsistensi menit bermain dan kontribusi merata lintas fase permainan");

  if (goalPct < 40 && positionLine(p.position) === "FW") growth.push("Konversi peluang masih di bawah median penyerang seusianya");
  if (assistPct < 40 && positionLine(p.position) === "MF") growth.push("Kontribusi umpan kunci perlu ditingkatkan untuk peran kreator");
  if (per90(p.keyPasses) < 1) growth.push("Keterlibatan pada fase build-up masih terbatas");
  if (p.yellowCards >= 3) growth.push(`Akumulasi ${p.yellowCards} kartu kuning — kelola agresivitas duel`);
  if (growth.length === 0) growth.push("Perluas variasi kontribusi (mis. kaki lemah, bola atas) untuk melengkapi profil");

  const pathway =
    scorePct >= 80
      ? "Layak dipromosikan ke kelompok umur di atasnya musim depan, disertai program penguatan fisik terukur dan pemantauan beban menit."
      : scorePct >= 55
        ? "Pertahankan di kelompok umur saat ini dengan target pengembangan spesifik; evaluasi ulang di akhir musim."
        : "Fokus pembinaan fundamental dan penambahan menit bermain kompetitif sebelum evaluasi jenjang berikutnya.";

  return {
    headline: `${p.name} — ${POS_LABEL[positionLine(p.position)]} dengan skor performa persentil ${scorePct} (${p.ageCode ?? "lintas KU"})`,
    summary: `Analisis berbasis ${p.appearances} penampilan (${p.minutesPlayed} menit) pada data LigaLokal. ${p.name} mencatat ${p.goals} gol, ${p.assists} assist, dan rating rata-rata ${p.rating.toFixed(1)}. ${pathway}`,
    sections: [
      { title: "Kekuatan", body: "Aspek yang menonjol dibanding rekan seposisi dan sekelompok umur:", bullets: strengths },
      { title: "Area pengembangan", body: "Prioritas peningkatan untuk melengkapi profil pemain:", bullets: growth },
      { title: "Rekomendasi jenjang pembinaan", body: pathway },
    ],
    ratings: [
      { label: "Serangan", value: Math.round(Math.min(100, per90(p.goals) / 1.1 * 100)) || 8 },
      { label: "Kreativitas", value: Math.round(Math.min(100, per90(p.assists) / 0.8 * 100)) || 8 },
      { label: "Bertahan", value: Math.round(Math.min(100, per90(p.tackles + p.interceptions) / 7 * 100)) || 8 },
      { label: "Fisik (menit)", value: Math.round(Math.min(100, p.minutesPlayed / (p.appearances * 90 || 1) * 100)) },
      { label: "Disiplin", value: Math.max(8, 100 - (p.yellowCards * 12 + p.redCards * 30)) },
    ],
    recommendations: [
      scorePct >= 80 ? "Promosi kelompok umur" : "Evaluasi ulang akhir musim",
      "Program strength & conditioning individual",
      positionLine(p.position) === "FW" ? "Latihan finishing kaki lemah & situasi 1v1" : "Latihan pengambilan keputusan di sepertiga akhir",
    ],
    tags: [POS_LABEL[positionLine(p.position)], scorePct >= 75 ? "prioritas-pemantauan" : "pemantauan-reguler"],
  };
}

export function demoMatchSummary(ctx: {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  events: { type: string; minute: number; team: "home" | "away"; player?: string | null }[];
  homeFormation: string;
  awayFormation: string;
}): AiReportResult {
  const goals = ctx.events.filter((e) => e.type === "goal" || e.type === "penalty_goal");
  const firstHalfGoals = goals.filter((g) => g.minute <= 45).length;
  const cards = ctx.events.filter((e) => e.type.includes("card")).length;
  const winner =
    ctx.homeScore > ctx.awayScore ? ctx.home : ctx.awayScore > ctx.homeScore ? ctx.away : null;

  const topScorer = (() => {
    const tally: Record<string, number> = {};
    goals.forEach((g) => g.player && (tally[g.player] = (tally[g.player] ?? 0) + 1));
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    return entries[0];
  })();

  return {
    headline: winner
      ? `${winner} menang ${Math.max(ctx.homeScore, ctx.awayScore)}–${Math.min(ctx.homeScore, ctx.awayScore)} atas ${winner === ctx.home ? ctx.away : ctx.home}`
      : `${ctx.home} dan ${ctx.away} berbagi angka ${ctx.homeScore}–${ctx.awayScore}`,
    summary: `Pertandingan ${ctx.homeFormation} melawan ${ctx.awayFormation} menghasilkan ${goals.length} gol (${firstHalfGoals} di babak pertama) dan ${cards} kartu. ${topScorer ? `${topScorer[0]} menjadi penentu dengan ${topScorer[1]} gol.` : ""}`,
    sections: [
      {
        title: "Pola taktik utama",
        body:
          firstHalfGoals > goals.length / 2
            ? "Kedua tim tampil terbuka sejak awal; laju gol melambat di babak kedua seiring penyesuaian pertahanan."
            : "Babak pertama berlangsung taktis dan ketat; ruang baru terbuka setelah pergantian pemain di babak kedua.",
        bullets: [
          `Distribusi gol: ${firstHalfGoals} babak 1 · ${goals.length - firstHalfGoals} babak 2`,
          `Tingkat pelanggaran/kartu: ${cards} kartu sepanjang laga`,
          winner ? `${winner} lebih efisien memanfaatkan peluang` : "Efisiensi kedua tim relatif setara",
        ],
      },
      {
        title: "Catatan untuk evaluasi",
        body: "Fokus review pelatih pasca-laga berdasarkan data kejadian yang tercatat di konsol pertandingan.",
      },
    ],
    ratings: [
      { label: "Intensitas", value: Math.min(100, 40 + goals.length * 12) },
      { label: "Fair play", value: Math.max(30, 100 - cards * 12) },
      { label: "Keterbukaan", value: Math.min(100, 30 + goals.length * 14) },
    ],
    tags: ["ringkasan-laga", winner ? "hasil-tegas" : "imbang"],
  };
}

export function demoCompetitionInsight(ctx: {
  name: string;
  matchesPlayed: number;
  totalGoals: number;
  topClub?: string | null;
  avgCardsPerMatch: number;
}): AiReportResult {
  const gpm = ctx.matchesPlayed ? ctx.totalGoals / ctx.matchesPlayed : 0;
  return {
    headline: `${ctx.name}: rata-rata ${gpm.toFixed(1)} gol per laga dari ${ctx.matchesPlayed} pertandingan`,
    summary: `Kompetisi berjalan dengan produktivitas gol ${gpm >= 3 ? "tinggi" : gpm >= 2 ? "sedang" : "rendah"} dan tingkat kartu ${ctx.avgCardsPerMatch.toFixed(1)} per pertandingan. ${ctx.topClub ? `${ctx.topClub} memimpin klasemen sementara.` : ""}`,
    sections: [
      {
        title: "Tren menonjol",
        body: "Gambaran umum dinamika kompetisi berdasarkan hasil yang telah dikonfirmasi.",
        bullets: [
          `Total ${ctx.totalGoals} gol dalam ${ctx.matchesPlayed} pertandingan`,
          `Rata-rata ${ctx.avgCardsPerMatch.toFixed(1)} kartu / laga — disiplin ${ctx.avgCardsPerMatch < 2 ? "terjaga baik" : "perlu perhatian"}`,
          ctx.topClub ? `${ctx.topClub} menunjukkan konsistensi papan atas` : "Persaingan papan atas masih ketat",
        ],
      },
      {
        title: "Rekomendasi operator",
        body:
          gpm < 2
            ? "Pertimbangkan evaluasi format atau durasi pertandingan untuk kelompok umur ini."
            : "Format berjalan sehat; pertimbangkan kuota menit bermain minimum untuk pemerataan pengembangan.",
      },
    ],
    ratings: [
      { label: "Kompetitivitas", value: Math.min(100, 55 + Math.round(gpm * 6)) },
      { label: "Fair play", value: Math.max(30, 100 - Math.round(ctx.avgCardsPerMatch * 18)) },
      { label: "Produktivitas gol", value: Math.min(100, Math.round(gpm * 22)) },
    ],
    tags: ["wawasan-kompetisi"],
  };
}
