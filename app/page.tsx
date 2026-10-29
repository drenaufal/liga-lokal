import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  Database,
  FileInput,
  Trophy,
  Radio,
  Radar,
  Sparkles,
  Activity,
  GitBranch,
  Keyboard,
  ScrollText,
  Check,
  Goal,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LiveSection } from "@/components/landing/live-section";
import { isPageLink, type LandingLink } from "@/components/landing/links";
import { Folder } from "@/components/landing/folder";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: t(
      "Sistem operasi terpadu untuk manajemen kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput berbasis AI.",
    ),
  };
}

/* Artwork exported from the homepage design (public/landing). Decorative — the copy carries the meaning. */
const ART = {
  devices: { src: "/landing/hero-devices.webp", width: 867, height: 487 },
  heroTeam: { src: "/landing/hero-team.webp", width: 483, height: 301 },
  teamArms: { src: "/landing/team-arms.webp", width: 742, height: 328 },
  teamModules: { src: "/landing/team-modules.webp", width: 1445, height: 923 },
  runner: { src: "/landing/player-runner.webp", width: 442, height: 686 },
  jump: { src: "/landing/player-jump.webp", width: 667, height: 827 },
  trophies: { src: "/landing/trophies.webp", width: 634, height: 631 },
  calendar: { src: "/landing/calendar.webp", width: 621, height: 527 },
  teamLogo: { src: "/landing/team-logo.webp", width: 976, height: 712 },
  highFive: { src: "/landing/team-highfive.webp", width: 193, height: 118 },
  ball: { src: "/landing/ball.webp", width: 159, height: 162 },
  logoWhite: { src: "/landing/logo-white.png", width: 842, height: 595 },
} as const;

function Art({ img, className, priority }: { img: (typeof ART)[keyof typeof ART]; className?: string; priority?: boolean }) {
  return (
    <Image
      src={img.src}
      width={img.width}
      height={img.height}
      alt=""
      aria-hidden
      unoptimized
      priority={priority}
      draggable={false}
      className={cn("pointer-events-none h-auto select-none", className)}
    />
  );
}

// Text below is message ids: the page renders it through `t.dyn(...)`.
const LINKS: LandingLink[] = [
  { href: "#pilar", label: msg("Pilar") },
  { href: "#alur", label: msg("Alur Kerja") },
  { href: "#modul", label: msg("Modul") },
  { href: "#implementasi", label: msg("Implementasi") },
  // open to everyone, signed in or not (see OPEN_VIEWS in lib/auth/redirect.ts)
  { href: "/kompetisi", label: msg("Kompetisi"), icon: "trophy" },
  { href: "/player-intelligence", label: "Player Intelligence", icon: "radar" },
];

const STATS = [
  { n: "7", label: msg("Modul kerja terintegrasi"), body: "#ec5951", tab: "#b23c37", text: "text-white" },
  { n: "4", label: msg("Format kompetisi"), body: "#4361ee", tab: "#1f307d", text: "text-white" },
  { n: "8", label: msg("Tahap QA data impor"), body: "#ffc8eb", tab: "#c597b2", text: "text-ink" },
  { n: "100%", label: msg("Proses dapat diaudit"), body: "#c3ffa9", tab: "#8fc77d", text: "text-ink" },
];

const CHALLENGES = [
  msg("Data pemain tersebar di berbagai spreadsheet dan dokumen terpisah"),
  msg("Pengelolaan turnamen dilakukan secara manual dan rawan kesalahan"),
  msg("Pelaporan statistik pertandingan berjalan lambat"),
  msg("Identifikasi talenta bersifat subjektif dan bergantung pengamatan manual"),
  msg("Komunikasi antar pemangku kepentingan terfragmentasi"),
  msg("Riwayat perkembangan pemain berisiko hilang antar musim"),
];

const STEPS = [
  { body: "#ec5951", tab: "#b23c37", text: "text-white", title: msg("Daftarkan"), desc: msg("Registrasi pemain, klub, pelatih, dan wasit — lengkap dengan verifikasi dokumen KIA.") },
  { body: "#4361ee", tab: "#1f307d", text: "text-white", title: msg("Jadwalkan"), desc: msg("Buat turnamen, tambahkan KU-nya, lalu dapatkan fixture otomatis untuk format Liga atau Cup — atau susun jadwal sendiri.") },
  { body: "#ffc8eb", tab: "#c597b2", text: "text-ink", title: msg("Pertandingkan"), desc: msg("Konsol laga langsung: klik pemain untuk mencatat gol, kartu, dan pergantian dari pinggir lapangan.") },
  { body: "#c3ffa9", tab: "#8fc77d", text: "text-ink", title: msg("Analisis"), desc: msg("Klasemen, radar performa, dan laporan AI Scout diperbarui seketika dari setiap kejadian.") },
];

const MODULES = [
  { icon: LayoutDashboard, block: "bg-[#e41e2a] text-white", name: "Command Center", desc: msg("Dasbor operasional real-time: status sistem, live match monitor, dan papan peringkat.") },
  { icon: Database, block: "bg-white text-ink", name: "Master Data & Registry", desc: msg("Basis data terpusat untuk pemain, klub, pelatih, wasit, venue, dan aturan kategori usia.") },
  { icon: FileInput, block: "bg-block-lavender text-ink", name: "Data Ingestion & Staging", desc: msg("Impor CSV dengan 8 tahap penjaminan kualitas, deteksi duplikasi, dan antrian tinjauan.") },
  { icon: Trophy, block: "bg-block-yellow text-ink", name: "Competition & Rules", desc: msg("Turnamen dengan banyak KU, format Liga & Cup — fixture otomatis atau manual, klasemen dan bagan real-time.") },
  { icon: Radio, block: "bg-block-blue text-white", name: "Match Operations", desc: msg("Konsol pertandingan langsung: klik pemain untuk mencatat kejadian, lalu validasi hasil.") },
  { icon: Radar, block: "bg-block-mint text-ink", name: "Player Intelligence", desc: msg("Grafik radar performa, perbandingan head-to-head, dan mesin formula penilaian.") },
  { icon: Sparkles, block: "bg-block-pink text-ink", name: "AI Scout & Insights", desc: msg("Pencarian talenta bahasa natural dan laporan analisis pemain otomatis.") },
];

const VALUES = [
  { icon: Database, title: "Single Source of Truth", body: msg("Menghilangkan duplikasi data dan perbedaan versi antar dokumen kerja.") },
  { icon: Activity, title: "Real-Time Match Engine", body: msg("Hasil dan statistik pertandingan tersedia seketika, tanpa jeda pelaporan manual.") },
  { icon: Sparkles, title: "AI-Powered Talent Intelligence", body: msg("Proses scouting lebih objektif, cepat, dan berbasis data terukur.") },
  { icon: GitBranch, title: "Longitudinal Player Tracking", body: msg("Riwayat perkembangan pemain tercatat utuh sepanjang jenjang usia dan karier.") },
  { icon: Keyboard, title: msg("Navigasi Keyboard-First"), body: msg("Efisiensi kerja tim operasional harian, terutama saat hari pertandingan.") },
  { icon: ScrollText, title: msg("Jejak Audit Menyeluruh"), body: msg("Akuntabilitas dan transparansi proses bagi seluruh pemangku kepentingan.") },
];

const TIMELINE = [
  { phase: msg("Bulan ke-1"), weeks: msg("Minggu 1–4"), body: msg("Discovery & requirement alignment, konfigurasi Command Center, Master Data & Registry, Data Ingestion, serta migrasi data awal.") },
  { phase: msg("Bulan ke-2"), weeks: msg("Minggu 5–8"), body: msg("Konfigurasi Competition & Rules dan Match Operations, User Acceptance Test, pelatihan pengguna, dan go-live disertai hypercare.") },
];

const DELIVERABLES = [
  msg("Platform terkonfigurasi sesuai kebutuhan organisasi"),
  msg("Migrasi data master (pemain, klub, wasit, venue)"),
  msg("Dokumentasi penggunaan sistem per peran"),
  msg("Sesi pelatihan pengguna operasional"),
  msg("Pendampingan masa awal (hypercare support)"),
  msg("Keamanan data — kredensial via environment, rate limiting AI"),
];

/* Sample data for the illustrations (made-up names). */
const STANDINGS = [
  { short: "BSA", name: "Bintang Selatan", color: "#22d3ee", p: 6, pts: 16 },
  { short: "RBS", name: "Rajawali Bekasi", color: "#f87171", p: 6, pts: 13 },
  { short: "BKF", name: "Bogor Kencana", color: "#fb923c", p: 6, pts: 11 },
  { short: "DBJ", name: "Depok Bhayangkara", color: "#38bdf8", p: 6, pts: 8 },
];

/** Section label: small, bold, uppercase, coral. */
function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm font-bold uppercase tracking-wide text-coral sm:text-[16px]", className)}>{children}</p>
  );
}

/** Big condensed section headline. */
function Headline({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag className={cn("font-headline uppercase text-ink", className, "leading-[0.88]")}>{children}</Tag>
  );
}

const WRAP = "mx-auto w-full max-w-[1320px] px-4 sm:px-6";

export default async function LandingPage() {
  const { t } = await getI18n();
  // The design shows the three hero words without the full stop.
  const word = (s: string) => t.dyn(s).replace(/\.$/, "");

  return (
    <main className="overflow-x-clip bg-white">
      <LandingNav links={LINKS} />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pb-10 pt-28 sm:pt-36 lg:pb-14 lg:pt-44">
        <div aria-hidden className="pointer-events-none absolute -left-[22vw] -top-[30vw] size-[56vw] rounded-full bg-block-yellow sm:-left-[19vw] sm:-top-[29vw] sm:size-[44vw]" />

        <div className={cn(WRAP, "relative")}>
          {/* Crimson card — the top-right corner is cut away to make room for the tablet. */}
          <div
            aria-hidden
            className="absolute inset-x-4 inset-y-0 rounded-[2rem] bg-crimson sm:inset-x-6 sm:rounded-[2.5rem] lg:[clip-path:polygon(0_0,82%_0,90%_9%,99%_27%,100%_31%,100%_100%,0_100%)]"
          />

          <div className="relative grid items-start gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-6 lg:px-14 lg:py-16">
            <div className="text-white lg:pt-6">
              <h1 className="font-headline uppercase leading-[0.86]">
                <span className="block text-[54px] min-[420px]:text-[68px] sm:text-[112px] xl:text-[132px]">{word("Kompetisi.")}</span>
                <span className="block whitespace-nowrap text-[46px] min-[420px]:text-[58px] sm:text-[100px] xl:text-[118px]">
                  <span className="text-block-yellow">{word("Pemain.")}</span> {word("Talenta.")}
                </span>
              </h1>
              <p className="mt-6 max-w-md text-sm font-medium leading-snug tracking-[0.01em] sm:text-[15px]">
                {t(
                  "{brand} mengintegrasikan manajemen data pemain dan klub, pengelolaan turnamen, operasi pertandingan real-time, hingga intelligent talent scouting — dalam satu ekosistem digital yang terhubung dan dapat diaudit.",
                  { brand: BRAND.name },
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-block-yellow px-8 text-[11px] font-bold uppercase tracking-wide text-ink transition-transform hover:-translate-y-0.5 sm:text-xs"
                >
                  {t("Masuk ke Platform")} <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#modul"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-block-orange px-8 text-[11px] font-bold uppercase tracking-wide text-ink shadow-[0_14px_30px_-10px_rgba(255,104,33,0.75)] transition-transform hover:-translate-y-0.5 sm:text-xs"
                >
                  {t("Lihat 7 Modul Kerja")}
                </a>
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[
                    ["OP", "bg-brand text-white"],
                    ["WS", "bg-block-yellow text-ink"],
                    ["PL", "bg-block-blue text-white"],
                    ["SC", "bg-block-mint text-ink"],
                  ].map(([label, c]) => (
                    <span key={label} className={cn("grid size-11 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white", c)}>
                      {label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] leading-snug">
                  <span className="font-semibold uppercase">{t("Satu ruang kerja, enam peran")}</span>
                  <br />
                  <span className="uppercase text-white/85">{t("Operator · Wasit · Pelatih · Pemandu bakat")}</span>
                </p>
              </div>
            </div>

            {/* Product shot: laptop + tablet + phone, the four players standing in front. */}
            <div className="lg:-mt-32 lg:mr-[-2%]">
              <div className="relative mx-auto aspect-[907/607] w-full max-w-[760px] lg:max-w-none">
                <div
                  aria-hidden
                  className="absolute inset-x-[2%] top-[73%] h-[10%] rounded-[50%] bg-black/45 blur-xl"
                />
                <Art img={ART.devices} priority className="absolute left-0 top-0 w-[95.6%]" />
                <Art img={ART.heroTeam} priority className="absolute left-[42.1%] top-[50.4%] w-[53.3%] drop-shadow-[0_14px_14px_rgba(0,0,0,0.3)]" />
              </div>
              <div className="mt-4 flex items-center justify-center gap-5 text-white sm:mt-6 lg:justify-end lg:pr-4">
                <Image
                  src={ART.logoWhite.src}
                  width={ART.logoWhite.width}
                  height={ART.logoWhite.height}
                  alt={BRAND.name}
                  unoptimized
                  className="h-20 w-auto shrink-0 sm:h-24"
                />
                <span aria-hidden className="h-24 w-px bg-white sm:h-28" />
                <p className="max-w-[17rem] text-[11px] font-semibold leading-snug sm:text-xs">
                  {t("Sistem operasi terpadu untuk manajemen kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput berbasis AI.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Numbers ────────────────────────────────────────────────────── */}
      <section className={cn(WRAP, "py-6 lg:py-10")}>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {STATS.map((s) => (
            <Folder key={s.label} body={s.body} tab={s.tab} className="reveal">
              <div className={cn("flex h-full min-h-[120px] flex-col justify-end px-5 pb-6 pt-2 sm:min-h-[150px] sm:px-8", s.text)}>
                <div className="font-headline text-[64px] leading-[0.9] sm:text-[84px]">{s.n}</div>
                <div className="mt-2 text-xs font-semibold sm:text-sm">{t.dyn(s.label)}</div>
              </div>
            </Folder>
          ))}
        </div>
      </section>

      {/* ── Live & coming-soon tournaments ─────────────────────────────── */}
      <LiveSection />

      {/* ── Challenges ─────────────────────────────────────────────────── */}
      <section className="relative pb-16 pt-16 lg:pb-24 lg:pt-24">
        <div aria-hidden className="pointer-events-none absolute -left-[12vw] top-[24vw] hidden h-[34vw] w-[18vw] rounded-[3rem] bg-block-blush lg:block" />
        <div aria-hidden className="pointer-events-none absolute -right-[32vw] -top-[8vw] hidden size-[44vw] rounded-full bg-coral lg:block" />

        <div className={cn(WRAP, "relative")}>
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <div className="relative mx-auto mt-16 w-full max-w-[640px] aspect-[876/327] lg:mx-0 lg:max-w-none">
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-[68.5%] rounded-full bg-block-yellow" />
              <Art img={ART.teamArms} className="absolute bottom-0 left-[7.4%] w-[84.7%] drop-shadow-[0_10px_10px_rgba(0,0,0,0.12)]" />
            </div>
            <div>
              <Kicker>{t("Tantangan")}</Kicker>
              <Headline className="mt-2 text-[60px] sm:text-[84px] xl:text-[100px]">{t("Masalah yang kami selesaikan")}</Headline>
              <p className="mt-5 max-w-xl text-[16px] font-bold leading-snug text-coral sm:text-lg xl:text-xl">
                {t("Operasional sepak bola akar rumput masih bergantung pada spreadsheet, grup pesan, dan ingatan. Inilah yang kami ganti.")}
              </p>
            </div>
          </div>

          {/* The runner has its own column beside the cards so it never covers text. */}
          <div className="relative mt-12 lg:mt-16 lg:flex lg:items-end lg:gap-6">
            <div aria-hidden className="pointer-events-none relative hidden w-[19%] shrink-0 self-end lg:order-2 lg:block">
              <div className="absolute inset-x-[8%] bottom-[2%] h-[7%] rounded-[50%] bg-black/25 blur-md" />
              <Art img={ART.runner} className="relative -mb-2 w-full drop-shadow-[0_12px_14px_rgba(0,0,0,0.2)]" />
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:order-1 lg:min-w-0 lg:flex-1 lg:grid-cols-3">
              {CHALLENGES.map((c, i) => (
                <li
                  key={c}
                  className={cn(
                    "reveal flex min-h-[140px] flex-col gap-3 rounded-[2.5rem] px-7 py-6 lg:min-h-[150px]",
                    i < 3 ? "bg-block-orange text-ink" : "bg-block-blue text-white",
                  )}
                >
                  <span className="font-headline text-4xl leading-none">{String(i + 1).padStart(2, "0")}</span>
                  <p className="max-w-[18rem] text-sm font-semibold leading-snug">{t.dyn(c)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Pillars ────────────────────────────────────────────────────── */}
      <section id="pilar" className="scroll-mt-24 py-10 lg:py-16">
        <div className={WRAP}>
          <div className="max-w-xl">
            <Kicker>{t("Empat pilar")}</Kicker>
            <Headline className="mt-2 text-[56px] sm:text-[84px] xl:text-[100px]">{t("Empat pilar, satu sumber data")}</Headline>
            <p className="mt-5 text-[16px] font-bold leading-snug text-coral sm:text-lg">
              {t("Seluruh pilar terhubung melalui satu lapisan data terpusat — setiap perubahan langsung tercermin di seluruh sistem tanpa sinkronisasi manual.")}
            </p>
          </div>

          <div className="relative mt-10 grid gap-4 sm:gap-5 lg:mt-24 lg:grid-cols-[0.45fr_1fr]">
            <Art img={ART.trophies} className="pointer-events-none absolute -top-[340px] right-[6%] z-10 hidden w-[32%] lg:block xl:-top-[360px]" />

            <div className="grid gap-4 sm:gap-5">
              {/* Match ops */}
              <article className="reveal rounded-[2rem] bg-block-blue p-6 text-white sm:p-7">
                <span className="grid size-11 place-items-center rounded-full bg-white/20">
                  <Radio className="size-5" />
                </span>
                <h3 className="mt-5 font-headline text-4xl uppercase leading-none">Real-Time Match Ops</h3>
                <p className="mt-2.5 text-sm font-medium leading-snug">
                  {t("Klik pemain, pilih kejadian — skor, statistik, dan klasemen ikut berubah.")}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden>
                  <span className="flex flex-col gap-3 rounded-[1.1rem] bg-[#e41e2a] p-3 text-[11px] font-bold text-white">
                    <Goal className="size-4" /> {t("Gol")}
                  </span>
                  <span className="flex flex-col gap-3 rounded-[1.1rem] bg-block-yellow p-3 text-[11px] font-bold text-ink">
                    <span className="h-4 w-3 rotate-6 rounded-[2px] bg-[#ffc93c] ring-1 ring-black/20" /> {t("Kartu")}
                  </span>
                  <span className="flex flex-col gap-3 rounded-[1.1rem] bg-block-pink p-3 text-[11px] font-bold text-ink">
                    <ArrowLeftRight className="size-4" /> {t("Ganti")}
                  </span>
                </div>
              </article>

              {/* Player intelligence */}
              <article className="reveal flex items-end justify-between gap-3 rounded-[2rem] bg-block-yellow p-6 text-ink sm:p-7">
                <div>
                  <span className="grid size-11 place-items-center rounded-full bg-ink/10">
                    <Radar className="size-5" />
                  </span>
                  <h3 className="mt-5 font-headline text-4xl uppercase leading-[0.9]">Player Intelligence</h3>
                  <p className="mt-2.5 max-w-[11rem] text-sm font-medium leading-snug">{t("Radar performa dan riwayat karier jangka panjang.")}</p>
                </div>
                <RadarArt className="size-28 shrink-0 sm:size-32" />
              </article>
            </div>

            {/* Competition */}
            <article className="reveal relative rounded-[2rem] bg-coral p-6 text-white sm:rounded-[2.5rem] sm:p-8 lg:p-10">
              <h3 className="font-headline text-[44px] uppercase leading-[0.9] sm:text-[64px] xl:text-[76px]">Competition Management</h3>
              <p className="mt-3 max-w-md text-sm font-bold leading-snug">
                {t("Pengelolaan turnamen, format kompetisi, jadwal pertandingan, dan klasemen secara otomatis dan akurat.")}
              </p>
              <div className="mt-6 rounded-[1.75rem] bg-white p-3 text-ink shadow-[0_20px_40px_-16px_rgba(0,0,0,0.35)] sm:mt-8 sm:p-4" aria-hidden>
                <div className="flex items-center justify-between px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  <span>{t("Klasemen Grup A")}</span>
                  <span className="flex gap-8 sm:gap-12">
                    <span>{t("M")}</span>
                    <span>{t("Poin")}</span>
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {STANDINGS.map((s, i) => (
                    <li key={s.short} className={cn("flex items-center gap-3 rounded-full px-3 py-2", i < 2 ? "bg-[#fde8e9]" : "bg-surface-2")}>
                      <span className="w-4 text-center font-headline text-xl leading-none">{i + 1}</span>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[8px] font-bold" style={{ background: s.color }}>
                        {s.short}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                      <span className="flex items-center gap-8 text-right tabular-nums sm:gap-12">
                        <span className="w-3 text-sm text-ink-muted">{s.p}</span>
                        <span className="w-6 font-headline text-2xl leading-none">{s.pts}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>

          {/* AI scout */}
          <article className="reveal mt-4 flex flex-col gap-6 rounded-[2rem] bg-night p-6 text-white sm:mt-5 sm:rounded-[2.5rem] sm:p-9 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <span className="grid size-11 place-items-center rounded-full bg-white/10 text-brand">
                <Sparkles className="size-5" />
              </span>
              <h3 className="mt-5 font-headline text-4xl uppercase leading-none sm:text-5xl">AI Talent Scout</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-night-muted">
                {t("Pencarian dan evaluasi talenta berbasis kecerdasan buatan untuk keputusan scouting yang lebih objektif.")}
              </p>
            </div>
            <div className="w-full max-w-lg" aria-hidden>
              <div className="flex items-center gap-3 rounded-full bg-night-2 py-2 pl-5 pr-2 ring-1 ring-night-line">
                <Search className="size-4 shrink-0 text-night-muted" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{t("Gelandang KU-15 kaki kiri, umpan kunci tinggi")}</span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand">
                  <ArrowRight className="size-4" />
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["Arya Nugroho", "92"],
                  ["Dimas Gunawan", "88"],
                  ["Reza Ramadhan", "85"],
                ].map(([n, s]) => (
                  <span key={n} className="flex items-center gap-2 rounded-full bg-white py-1 pl-3 pr-1 text-xs font-semibold text-ink">
                    {n}
                    <span className="rounded-full bg-block-mint px-2 py-0.5 font-headline text-sm leading-none">{s}</span>
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <section id="alur" className="scroll-mt-24 py-16 lg:py-24">
        <div className={cn(WRAP, "grid items-center gap-10 lg:grid-cols-[0.42fr_1fr] lg:gap-8")}>
          <div className="relative mx-auto aspect-[667/827] w-full max-w-[420px] lg:mx-0 lg:max-w-none">
            <div aria-hidden className="absolute bottom-[6%] left-[-60vw] right-[18%] top-[6.8%] rounded-r-[4rem] bg-block-orange lg:rounded-r-[5rem]" />
            <Art img={ART.jump} className="absolute inset-0 w-full" />
          </div>

          <div>
            <Kicker>{t("Alur kerja")}</Kicker>
            <Headline className="mt-2 max-w-3xl text-[56px] sm:text-[84px] xl:text-[100px]">{t("Dari pendaftaran ke peluit akhir")}</Headline>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:flex lg:gap-0">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className={cn("reveal relative lg:min-w-0 lg:flex-1", i > 0 && "lg:-ml-9")}
                  style={{ zIndex: i + 1 }}
                >
                  <Folder body={s.body} tab={s.tab} className={cn("h-full", i === 1 && "lg:mt-3", i === 2 && "lg:mt-6", i === 3 && "lg:mt-9")}>
                    <div className={cn("flex h-full min-h-[210px] flex-col px-5 pb-6 pt-3 sm:px-6", i < 3 && "lg:pr-12", s.text)}>
                      <span className="font-headline text-5xl leading-none">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="mt-3 font-headline text-3xl uppercase leading-none">{t.dyn(s.title)}</h3>
                      <p className="mt-3 text-xs font-bold leading-snug">{t.dyn(s.desc)}</p>
                    </div>
                  </Folder>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Modules + values ───────────────────────────────────────────── */}
      <section id="modul" className="scroll-mt-16 rounded-t-[3rem] bg-black pt-8 sm:rounded-t-[5rem] sm:pt-12 lg:rounded-b-[7rem] lg:rounded-t-[9rem] lg:pt-16">
        <div className="mx-0 overflow-hidden rounded-t-[2.5rem] bg-block-sun sm:rounded-t-[4.5rem] lg:rounded-b-[6rem] lg:rounded-t-[8rem]">
          <div className={cn(WRAP, "pt-12 sm:pt-16 lg:pt-20")}>
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
              <div className="lg:pt-20">
                <Kicker>{t("Modul")}</Kicker>
                <Headline className="mt-2 text-[56px] sm:text-[84px] xl:text-[96px]">{t("Tujuh modul kerja")}</Headline>
                <p className="mt-5 max-w-sm text-[16px] font-bold leading-snug text-coral sm:text-lg">
                  {t("Dirancang mengikuti alur kerja nyata organisasi pengelola kompetisi, dari perencanaan hingga evaluasi pasca-pertandingan.")}
                </p>
              </div>
              <ol>
                {MODULES.map((m, i) => (
                  <li
                    key={m.name}
                    className={cn(
                      "reveal relative flex flex-col gap-2 rounded-[1.75rem] px-5 pb-9 pt-4 shadow-[0_6px_12px_-8px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6",
                      i > 0 && "-mt-5",
                      m.block,
                    )}
                    style={{ zIndex: i + 1 }}
                  >
                    <div className="flex items-end gap-3">
                      <span className="pb-1 text-[11px] font-bold opacity-60">0{i + 1}</span>
                      <h3 className="font-headline text-[34px] uppercase leading-[0.95] sm:text-[42px]">{m.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 sm:max-w-[16.5rem]">
                      <p className="text-[11px] font-medium leading-snug">{t.dyn(m.desc)}</p>
                      <m.icon className="size-5 shrink-0" />
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Players, cropped by the panel's bottom edge */}
            <div className="relative mx-auto mt-6 aspect-[1445/520] w-full max-w-[1000px] overflow-hidden lg:-mt-14">
              <Art img={ART.teamModules} className="absolute left-0 top-0 w-full" />
              <Art img={ART.ball} className="absolute left-[22%] top-[33.6%] w-[11%]" />
            </div>
          </div>
        </div>

        <div id="nilai" className={cn(WRAP, "pb-16 pt-12 lg:pb-24 lg:pt-16")}>
          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="reveal rounded-[1.75rem] bg-[#1f1f1f] p-5 ring-1 ring-white/5">
                <span className="grid size-10 place-items-center rounded-full bg-[#e41e2a] text-white">
                  <v.icon className="size-[18px]" />
                </span>
                <h3 className="mt-5 text-sm font-semibold text-white">{t.dyn(v.title)}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-night-muted">{t.dyn(v.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Implementation ─────────────────────────────────────────────── */}
      <section id="implementasi" className="relative scroll-mt-24 py-16 lg:py-28">
        <div aria-hidden className="pointer-events-none absolute -right-[22vw] top-4 size-[70vw] rounded-full bg-block-pink sm:top-10 lg:-right-[16vw] lg:size-[42vw]" />
        <div className={cn(WRAP, "relative")}>
          <div className="relative">
            <Art img={ART.calendar} className="relative z-10 -mb-8 ml-auto w-[40%] sm:absolute sm:-top-4 sm:right-[2%] sm:mb-0 sm:w-[32%] lg:-top-24 lg:w-[30%]" />
            <div className="relative max-w-3xl lg:max-w-[68%]">
              <Kicker className="lg:pl-1">{t("Implementasi")}</Kicker>
              <Headline className="mt-1 text-[64px] sm:text-[104px] xl:text-[132px]">{t("Siap dalam dua bulan")}</Headline>
              <p className="mt-4 max-w-xl text-[16px] font-bold leading-snug text-coral sm:text-lg">
                {t("Direncanakan tuntas dalam 2 (dua) bulan sejak kick-off, terbagi ke dalam dua periode kerja utama.")}
              </p>
            </div>
          </div>

          <div className="relative mt-14 grid gap-4 sm:mt-20 md:grid-cols-2 md:gap-6">
            {TIMELINE.map((ph, i) => (
              <div
                key={ph.phase}
                className={cn("reveal rounded-[2.5rem] p-7 sm:p-9", i === 0 ? "bg-block-yellow text-ink" : "bg-block-royal text-white")}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-headline text-[84px] leading-[0.85] sm:text-[104px]">0{i + 1}</span>
                  <span className="pt-2 text-xs font-bold uppercase">{t.dyn(ph.weeks)}</span>
                </div>
                <h3 className="mt-3 text-3xl font-bold uppercase leading-none sm:text-[40px]">{t.dyn(ph.phase)}</h3>
                <p className="mt-4 max-w-md text-[13px] font-bold leading-snug">{t.dyn(ph.body)}</p>
              </div>
            ))}
          </div>

          <ul className="relative mt-6 grid gap-x-8 gap-y-3 rounded-[2rem] bg-white p-6 shadow-[0_10px_40px_-18px_rgba(0,0,0,0.25)] ring-1 ring-black/5 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
            {DELIVERABLES.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-secondary">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#e41e2a] text-white">
                  <Check className="size-3" />
                </span>
                {t.dyn(d)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className={cn(WRAP, "pb-16 lg:pb-24")}>
        <div className="reveal relative grid items-center gap-6 overflow-hidden rounded-[2.5rem] bg-stone px-6 pb-8 pt-10 sm:rounded-[3.5rem] sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-14 lg:pb-0 lg:pt-0">
          <Art img={ART.teamLogo} className="mx-auto w-full max-w-[520px] drop-shadow-[0_16px_14px_rgba(0,0,0,0.22)] lg:mx-0 lg:max-w-none lg:self-end" />
          <div className="lg:py-16">
            <h2 className="font-headline text-[56px] uppercase leading-[0.9] text-block-royal sm:text-[76px] xl:text-[88px]">
              {t("Siap melihat {brand} bekerja?", { brand: BRAND.name })}
            </h2>
            <p className="mt-6 max-w-md text-sm font-semibold leading-snug text-ink sm:text-[16px]">
              {t("Masuk untuk menjelajahi seluruh tujuh modul, dari kompetisi akar rumput hingga intelijen pemain.")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#e41e2a] px-9 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                {t("Masuk ke Platform")} <ArrowUpRight className="size-4" />
              </Link>
              <a
                href="#modul"
                className="inline-flex h-14 items-center justify-center rounded-full bg-white px-9 text-sm font-semibold text-[#e41e2a] transition-colors hover:bg-white/80"
              >
                {t("Tinjau modul")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="rounded-t-[2.5rem] bg-night text-night-muted sm:rounded-t-[4.5rem] lg:rounded-t-[7rem]">
        <div className={cn(WRAP, "max-w-[1100px] pb-10 pt-14 lg:pt-20")}>
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-5">
                <Image
                  src={ART.logoWhite.src}
                  width={ART.logoWhite.width}
                  height={ART.logoWhite.height}
                  alt={BRAND.name}
                  unoptimized
                  className="h-20 w-auto shrink-0"
                />
                <Art img={ART.highFive} className="w-32 sm:w-36" />
              </div>
              <p className="mt-5 max-w-xs text-xs leading-relaxed">
                {t("{tagline} — sistem operasi terpadu untuk kompetisi, data pemain, dan talenta sepak bola akar rumput Indonesia.", { tagline: BRAND.tagline })}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Platform</p>
              <ul className="mt-4 space-y-2.5 text-xs">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    {isPageLink(l) ? (
                      <Link href={l.href} className="transition-colors hover:text-white">
                        {t.dyn(l.label)}
                      </Link>
                    ) : (
                      <a href={l.href} className="transition-colors hover:text-white">
                        {t.dyn(l.label)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">{t("Akses")}</p>
              <ul className="mt-4 space-y-2.5 text-xs">
                <li>
                  <Link href="/login" className="transition-colors hover:text-white">
                    {t("Masuk ke platform")}
                  </Link>
                </li>
                <li>
                  <a href={BRAND.url} className="transition-colors hover:text-white">
                    www.{BRAND.domain}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-night-line pt-6 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} {BRAND.owner}
            </span>
            <span className="flex items-center gap-3">
              <LanguageSwitcher tone="dark" />
              {t("Dokumen Rahasia & Terbatas")}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/** Layered performance radar for the Player Intelligence card. */
function RadarArt({ className }: { className?: string }) {
  const hex = (r: number, cx = 50, cy = 50) =>
    [0, 1, 2, 3, 4].map((k) => {
      const a = ((Math.PI * 2) / 5) * k - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {[46, 34, 22].map((r) => (
        <polygon key={r} points={hex(r)} fill="none" stroke="#141414" strokeOpacity={0.22} />
      ))}
      <polygon points="50,6 92,38 70,88 26,84 10,36" fill="#ff6821" fillOpacity={0.85} />
      <polygon points="50,18 82,40 62,80 30,70 20,40" fill="#9990fa" fillOpacity={0.8} />
      <polygon points="50,30 70,46 56,68 38,62 34,44" fill="#ff72ab" fillOpacity={0.9} />
    </svg>
  );
}
