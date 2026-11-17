import type { AiReportResult } from "@/lib/db/schema";
import { createT, msg, type TFunction } from "@/lib/i18n/translate";
import { percentile } from "@/lib/scoring";
import { positionLine } from "@/lib/positions";

const INDONESIAN = createT("id", {});

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

const POS_LABEL = {
  GK: msg("kiper::sebutan"),
  DF: msg("pemain bertahan"),
  MF: msg("gelandang"),
  FW: msg("penyerang"),
} as const;

/**
 * Data-driven player analysis — genuine (from real stats), just generated offline.
 * Written in the language of `t`: a stored report keeps the language it was generated in.
 */
export function demoPlayerAnalysis(p: PlayerCtx, peers: PeerStat[], t: TFunction = INDONESIAN): AiReportResult {
  const per90 = (n: number) => (p.minutesPlayed ? (n / p.minutesPlayed) * 90 : 0);
  const scorePct = percentile(p.score, peers.map((x) => x.score));
  const goalPct = percentile(p.goals, peers.map((x) => x.goals));
  const assistPct = percentile(p.assists, peers.map((x) => x.assists));
  const pos = t(POS_LABEL[positionLine(p.position)]);

  const strengths: string[] = [];
  const growth: string[] = [];

  if (goalPct >= 70) strengths.push(t("Produktivitas gol persentil {pct} untuk {pos} {age}", { pct: goalPct, pos, age: p.ageCode ?? "" }).trim());
  if (assistPct >= 70) strengths.push(t("Kreativitas (assist) persentil {pct} — kontributor peluang utama", { pct: assistPct }));
  if (per90(p.tackles + p.interceptions) >= 4) strengths.push(t("Aktivitas defensif tinggi ({n} tekel+intersep / 90)", { n: per90(p.tackles + p.interceptions).toFixed(1) }));
  if (p.position === "GK" && p.cleanSheets >= 2) strengths.push(t("{n} nirbobol dari {apps} penampilan", { n: p.cleanSheets, apps: p.appearances }));
  if (p.yellowCards + p.redCards === 0 && p.appearances >= 4) strengths.push(t("Disiplin sangat baik — nihil kartu sepanjang kompetisi"));
  if (p.motm > 0) strengths.push(t("{n}× terpilih sebagai Pemain Terbaik Pertandingan", { n: p.motm }));
  if (strengths.length === 0) strengths.push(t("Konsistensi menit bermain dan kontribusi merata lintas fase permainan"));

  if (goalPct < 40 && positionLine(p.position) === "FW") growth.push(t("Konversi peluang masih di bawah median penyerang seusianya"));
  if (assistPct < 40 && positionLine(p.position) === "MF") growth.push(t("Kontribusi umpan kunci perlu ditingkatkan untuk peran kreator"));
  if (per90(p.keyPasses) < 1) growth.push(t("Keterlibatan pada fase build-up masih terbatas"));
  if (p.yellowCards >= 3) growth.push(t("Akumulasi {n} kartu kuning — kelola agresivitas duel", { n: p.yellowCards }));
  if (growth.length === 0) growth.push(t("Perluas variasi kontribusi (mis. kaki lemah, bola atas) untuk melengkapi profil"));

  const pathway =
    scorePct >= 80
      ? t("Layak dipromosikan ke kelompok umur di atasnya musim depan, disertai program penguatan fisik terukur dan pemantauan beban menit.")
      : scorePct >= 55
        ? t("Pertahankan di kelompok umur saat ini dengan target pengembangan spesifik; evaluasi ulang di akhir musim.")
        : t("Fokus pembinaan fundamental dan penambahan menit bermain kompetitif sebelum evaluasi jenjang berikutnya.");

  return {
    headline: t("{name} — {pos} dengan skor performa persentil {pct} ({age})", { name: p.name, pos, pct: scorePct, age: p.ageCode ?? t("lintas KU") }),
    summary: t("Analisis berbasis {apps} penampilan ({mins} menit) pada data LigaLokal. {name} mencatat {goals} gol, {assists} assist, dan rating rata-rata {rating}. {pathway}", {
      apps: p.appearances, mins: p.minutesPlayed, name: p.name, goals: p.goals, assists: p.assists, rating: p.rating.toFixed(1), pathway,
    }),
    sections: [
      { title: t("Kekuatan"), body: t("Aspek yang menonjol dibanding rekan seposisi dan sekelompok umur:"), bullets: strengths },
      { title: t("Area pengembangan"), body: t("Prioritas peningkatan untuk melengkapi profil pemain:"), bullets: growth },
      { title: t("Rekomendasi jenjang pembinaan"), body: pathway },
    ],
    ratings: [
      { label: t("Serangan"), value: Math.round(Math.min(100, per90(p.goals) / 1.1 * 100)) || 8 },
      { label: t("Kreativitas"), value: Math.round(Math.min(100, per90(p.assists) / 0.8 * 100)) || 8 },
      { label: t("Bertahan"), value: Math.round(Math.min(100, per90(p.tackles + p.interceptions) / 7 * 100)) || 8 },
      { label: t("Fisik (menit)"), value: Math.round(Math.min(100, p.minutesPlayed / (p.appearances * 90 || 1) * 100)) },
      { label: t("Disiplin"), value: Math.max(8, 100 - (p.yellowCards * 12 + p.redCards * 30)) },
    ],
    recommendations: [
      scorePct >= 80 ? t("Promosi kelompok umur") : t("Evaluasi ulang akhir musim"),
      t("Program strength & conditioning individual"),
      positionLine(p.position) === "FW" ? t("Latihan finishing kaki lemah & situasi 1v1") : t("Latihan pengambilan keputusan di sepertiga akhir"),
    ],
    tags: [pos, scorePct >= 75 ? t("prioritas-pemantauan") : t("pemantauan-reguler")],
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
}, t: TFunction = INDONESIAN): AiReportResult {
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

  const headScore = Math.max(ctx.homeScore, ctx.awayScore);
  const tailScore = Math.min(ctx.homeScore, ctx.awayScore);
  const decisive = topScorer ? t("{name} menjadi penentu dengan {n} gol.", { name: topScorer[0], n: topScorer[1] }) : "";

  return {
    headline: winner
      ? t("{winner} menang {a}–{b} atas {loser}", { winner, a: headScore, b: tailScore, loser: winner === ctx.home ? ctx.away : ctx.home })
      : t("{home} dan {away} berbagi angka {a}–{b}", { home: ctx.home, away: ctx.away, a: ctx.homeScore, b: ctx.awayScore }),
    summary: t("Pertandingan {homeF} melawan {awayF} menghasilkan {goals} gol ({first} di babak pertama) dan {cards} kartu.", {
      homeF: ctx.homeFormation, awayF: ctx.awayFormation, goals: goals.length, first: firstHalfGoals, cards,
    }) + (decisive ? ` ${decisive}` : ""),
    sections: [
      {
        title: t("Pola taktik utama"),
        body:
          firstHalfGoals > goals.length / 2
            ? t("Kedua tim tampil terbuka sejak awal; laju gol melambat di babak kedua seiring penyesuaian pertahanan.")
            : t("Babak pertama berlangsung taktis dan ketat; ruang baru terbuka setelah pergantian pemain di babak kedua."),
        bullets: [
          t("Distribusi gol: {a} babak 1 · {b} babak 2", { a: firstHalfGoals, b: goals.length - firstHalfGoals }),
          t("Tingkat pelanggaran/kartu: {n} kartu sepanjang laga", { n: cards }),
          winner ? t("{winner} lebih efisien memanfaatkan peluang", { winner }) : t("Efisiensi kedua tim relatif setara"),
        ],
      },
      {
        title: t("Catatan untuk evaluasi"),
        body: t("Fokus review pelatih pasca-laga berdasarkan data kejadian yang tercatat di konsol pertandingan."),
      },
    ],
    ratings: [
      { label: t("Intensitas"), value: Math.min(100, 40 + goals.length * 12) },
      { label: t("Fair play"), value: Math.max(30, 100 - cards * 12) },
      { label: t("Keterbukaan"), value: Math.min(100, 30 + goals.length * 14) },
    ],
    tags: [t("ringkasan-laga"), winner ? t("hasil-tegas") : t("imbang::tag")],
  };
}

export function demoCompetitionInsight(ctx: {
  name: string;
  matchesPlayed: number;
  totalGoals: number;
  topClub?: string | null;
  avgCardsPerMatch: number;
}, t: TFunction = INDONESIAN): AiReportResult {
  const gpm = ctx.matchesPlayed ? ctx.totalGoals / ctx.matchesPlayed : 0;
  const cardsPerMatch = ctx.avgCardsPerMatch.toFixed(1);
  const leader = ctx.topClub ? t("{club} memimpin klasemen sementara.", { club: ctx.topClub }) : "";
  return {
    headline: t("{name}: rata-rata {gpm} gol per laga dari {n} pertandingan", { name: ctx.name, gpm: gpm.toFixed(1), n: ctx.matchesPlayed }),
    summary: t("Kompetisi berjalan dengan produktivitas gol {level} dan tingkat kartu {cards} per pertandingan.", {
      level: gpm >= 3 ? t("tinggi::level") : gpm >= 2 ? t("sedang::level") : t("rendah::level"),
      cards: cardsPerMatch,
    }) + (leader ? ` ${leader}` : ""),
    sections: [
      {
        title: t("Tren menonjol"),
        body: t("Gambaran umum dinamika kompetisi berdasarkan hasil yang telah dikonfirmasi."),
        bullets: [
          t("Total {goals} gol dalam {n} pertandingan", { goals: ctx.totalGoals, n: ctx.matchesPlayed }),
          ctx.avgCardsPerMatch < 2
            ? t("Rata-rata {cards} kartu / laga — disiplin terjaga baik", { cards: cardsPerMatch })
            : t("Rata-rata {cards} kartu / laga — disiplin perlu perhatian", { cards: cardsPerMatch }),
          ctx.topClub ? t("{club} menunjukkan konsistensi papan atas", { club: ctx.topClub }) : t("Persaingan papan atas masih ketat"),
        ],
      },
      {
        title: t("Rekomendasi operator"),
        body:
          gpm < 2
            ? t("Pertimbangkan evaluasi format atau durasi pertandingan untuk kelompok umur ini.")
            : t("Format berjalan sehat; pertimbangkan kuota menit bermain minimum untuk pemerataan pengembangan."),
      },
    ],
    ratings: [
      { label: t("Kompetitivitas"), value: Math.min(100, 55 + Math.round(gpm * 6)) },
      { label: t("Fair play"), value: Math.max(30, 100 - Math.round(ctx.avgCardsPerMatch * 18)) },
      { label: t("Produktivitas gol"), value: Math.min(100, Math.round(gpm * 22)) },
    ],
    tags: [t("wawasan-kompetisi")],
  };
}
