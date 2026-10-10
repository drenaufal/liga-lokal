import Link from "next/link";
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
  UserPlus,
  CalendarDays,
  BarChart3,
  X,
} from "lucide-react";
import { Logo, LogoChip } from "@/components/brand/logo";
import { LandingNav, type LandingLink } from "@/components/landing/landing-nav";
import { PhoneMockup } from "@/components/landing/phone-mockup";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    "Sistem operasi terpadu untuk manajemen kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput berbasis AI.",
};

/* Colour blocks from the design system — fill + the text colour that clears 4.5:1 on it. */
const BLOCK = {
  red: "bg-brand text-white",
  blue: "bg-block-blue text-white",
  yellow: "bg-block-yellow text-ink",
  night: "bg-night text-white",
  pink: "bg-block-pink text-ink",
  mint: "bg-block-mint text-ink",
  lavender: "bg-block-lavender text-ink",
} as const;

const LINKS: LandingLink[] = [
  { href: "#pilar", label: "Pilar" },
  { href: "#alur", label: "Alur Kerja" },
  { href: "#modul", label: "Modul" },
  { href: "#implementasi", label: "Implementasi" },
];

const CHALLENGES = [
  "Data pemain tersebar di berbagai spreadsheet dan dokumen terpisah",
  "Pengelolaan turnamen dilakukan secara manual dan rawan kesalahan",
  "Pelaporan statistik pertandingan berjalan lambat",
  "Identifikasi talenta bersifat subjektif dan bergantung pengamatan manual",
  "Komunikasi antar pemangku kepentingan terfragmentasi",
  "Riwayat perkembangan pemain berisiko hilang antar musim",
];

const STEPS = [
  { icon: UserPlus, block: BLOCK.red, title: "Daftarkan", body: "Registrasi pemain, klub, pelatih, dan wasit — lengkap dengan verifikasi dokumen KIA." },
  { icon: CalendarDays, block: BLOCK.blue, title: "Jadwalkan", body: "Buat turnamen, tambahkan KU-nya, lalu dapatkan fixture otomatis untuk format Liga atau Cup — atau susun jadwal sendiri." },
  { icon: Goal, block: BLOCK.yellow, title: "Pertandingkan", body: "Konsol laga langsung: klik pemain untuk mencatat gol, kartu, dan pergantian dari pinggir lapangan." },
  { icon: BarChart3, block: BLOCK.night, title: "Analisis", body: "Klasemen, radar performa, dan laporan AI Scout diperbarui seketika dari setiap kejadian." },
];

const MODULES = [
  { icon: LayoutDashboard, block: BLOCK.red, name: "Command Center", desc: "Dasbor operasional real-time: status sistem, live match monitor, dan papan peringkat." },
  { icon: Database, block: "bg-surface text-ink", name: "Master Data & Registry", desc: "Basis data terpusat untuk pemain, klub, pelatih, wasit, venue, dan aturan kategori usia." },
  { icon: FileInput, block: BLOCK.lavender, name: "Data Ingestion & Staging", desc: "Impor CSV dengan 8 tahap penjaminan kualitas, deteksi duplikasi, dan antrian tinjauan." },
  { icon: Trophy, block: BLOCK.yellow, name: "Competition & Rules", desc: "Turnamen dengan banyak KU, format Liga & Cup — fixture otomatis atau manual, klasemen dan bagan real-time." },
  { icon: Radio, block: BLOCK.blue, name: "Match Operations", desc: "Konsol pertandingan langsung: klik pemain untuk mencatat kejadian, lalu validasi hasil." },
  { icon: Radar, block: BLOCK.mint, name: "Player Intelligence", desc: "Grafik radar performa, perbandingan head-to-head, dan mesin formula penilaian." },
  { icon: Sparkles, block: BLOCK.pink, name: "AI Scout & Insights", desc: "Pencarian talenta bahasa natural dan laporan analisis pemain otomatis." },
];

const VALUES = [
  { icon: Database, title: "Single Source of Truth", body: "Menghilangkan duplikasi data dan perbedaan versi antar dokumen kerja." },
  { icon: Activity, title: "Real-Time Match Engine", body: "Hasil dan statistik pertandingan tersedia seketika, tanpa jeda pelaporan manual." },
  { icon: Sparkles, title: "AI-Powered Talent Intelligence", body: "Proses scouting lebih objektif, cepat, dan berbasis data terukur." },
  { icon: GitBranch, title: "Longitudinal Player Tracking", body: "Riwayat perkembangan pemain tercatat utuh sepanjang jenjang usia dan karier." },
  { icon: Keyboard, title: "Navigasi Keyboard-First", body: "Efisiensi kerja tim operasional harian, terutama saat hari pertandingan." },
  { icon: ScrollText, title: "Jejak Audit Menyeluruh", body: "Akuntabilitas dan transparansi proses bagi seluruh pemangku kepentingan." },
];

const TIMELINE = [
  { phase: "Bulan ke-1", weeks: "Minggu 1–4", body: "Discovery & requirement alignment, konfigurasi Command Center, Master Data & Registry, Data Ingestion, serta migrasi data awal." },
  { phase: "Bulan ke-2", weeks: "Minggu 5–8", body: "Konfigurasi Competition & Rules dan Match Operations, User Acceptance Test, pelatihan pengguna, dan go-live disertai hypercare." },
];

const DELIVERABLES = [
  "Platform terkonfigurasi sesuai kebutuhan organisasi",
  "Migrasi data master (pemain, klub, wasit, venue)",
  "Dokumentasi penggunaan sistem per peran",
  "Sesi pelatihan pengguna operasional",
  "Pendampingan masa awal (hypercare support)",
  "Keamanan data — kredensial via environment, rate limiting AI",
];

/* Sample data for the illustrations (names from the demo seed). */
const SCORES = [
  { live: true, text: "CPF 2–2 BSA", meta: "63’" },
  { live: true, text: "MBJ 5–2 GMF", meta: "65’" },
  { live: true, text: "DBJ 0–0 BKF", meta: "Babak 1" },
  { text: "TEM 1–3 JTU", meta: "FT" },
  { text: "PJD vs CRF", meta: "Min 15:00" },
  { text: "RBS 2–0 DGS", meta: "FT" },
];
const MODULE_TICKER = ["Command Center", "Registry", "Ingestion", "Kompetisi", "Match Ops", "Player Intelligence", "AI Scout"];

const STANDINGS = [
  { short: "BSA", name: "Bintang Selatan", color: "#22d3ee", p: 6, pts: 16 },
  { short: "RBS", name: "Rajawali Bekasi", color: "#f87171", p: 6, pts: 13 },
  { short: "BKF", name: "Bogor Kencana", color: "#fb923c", p: 6, pts: 11 },
  { short: "DBJ", name: "Depok Bhayangkara", color: "#38bdf8", p: 6, pts: 8 },
];

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand", className)}>
      <span className="h-px w-6 bg-current" />
      {children}
    </p>
  );
}

function SectionTitle({ kicker, title, body, dark }: { kicker: string; title: string; body?: string; dark?: boolean }) {
  return (
    <div className="max-w-3xl">
      <Kicker>{kicker}</Kicker>
      <h2
        className={cn(
          "mt-3 font-display text-[44px] uppercase leading-[0.95] tracking-wide sm:text-6xl",
          dark ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
      {body && (
        <p className={cn("mt-4 max-w-2xl text-base leading-relaxed", dark ? "text-night-muted" : "text-ink-secondary")}>
          {body}
        </p>
      )}
    </div>
  );
}

function Ticker({ items, className, reverse }: { items: React.ReactNode[]; className?: string; reverse?: boolean }) {
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {items}
    </div>
  );
  return (
    <div className={cn("w-[112%] -translate-x-[6%] overflow-hidden py-3.5", className)}>
      <div className={cn("flex w-max animate-marquee", reverse && "[animation-direction:reverse]")}>
        {row()}
        {row(true)}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="overflow-x-clip bg-base">
      <LandingNav links={LINKS} />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 sm:pt-32">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-10 size-[38rem] rounded-full bg-brand/10 blur-3xl" />
        <Logo
          title=""
          className="pointer-events-none absolute -left-40 bottom-0 h-[520px] opacity-[0.05]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[11px] font-semibold text-ink-secondary ring-1 ring-line">
              <span className="size-2 rounded-full bg-brand animate-live" />
              Sistem Operasi Sepak Bola Akar Rumput
            </span>
            <h1 className="mt-6 font-display text-[60px] uppercase leading-[0.88] tracking-wide text-ink sm:text-[88px] lg:text-[100px]">
              Kompetisi.
              <br />
              <span className="text-brand">Pemain.</span>
              <br />
              <span className="text-ink/25">Talenta.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
              {BRAND.name} mengintegrasikan manajemen data pemain dan klub, pengelolaan turnamen,
              operasi pertandingan real-time, hingga intelligent talent scouting — dalam satu
              ekosistem digital yang terhubung dan dapat diaudit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-8 text-sm font-semibold text-white shadow-[0_16px_34px_-14px_rgba(228,34,45,0.85)] transition-colors hover:bg-brand-dark"
              >
                Jelajahi Demo Platform <ArrowRight className="size-4" />
              </Link>
              <a
                href="#modul"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-surface px-8 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:ring-ink/30"
              >
                Lihat 7 Modul Kerja
              </a>
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {[
                  ["OP", "bg-brand text-white"],
                  ["WS", "bg-block-yellow text-ink"],
                  ["PL", "bg-block-blue text-white"],
                  ["SC", "bg-night text-white"],
                ].map(([t, c]) => (
                  <span key={t} className={cn("grid size-10 place-items-center rounded-full text-[10px] font-bold ring-[3px] ring-base", c)}>
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-snug text-ink-secondary">
                <span className="font-semibold text-ink">Satu ruang kerja, enam peran</span>
                <br />
                Operator · Wasit · Pelatih · Pemandu bakat
              </p>
            </div>
          </div>

          {/* Product shot */}
          <div className="relative mx-auto flex w-full max-w-md justify-center py-6">
            {/* ticket peeking behind the phone */}
            <div className="absolute -right-6 -top-2 hidden w-56 rotate-[9deg] rounded-3xl bg-block-pink p-4 text-right text-ink shadow-xl sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider">KU-13 · Final</p>
              <p className="mt-1 font-display text-5xl leading-none">15:00</p>
              <p className="mt-1 text-xs font-semibold">PJD vs CRF</p>
            </div>

            <PhoneMockup className="relative animate-float-slow" />

            {/* event toast */}
            <div className="absolute -left-1 top-20 w-52 rounded-2xl bg-night p-3 text-white shadow-[0_24px_50px_-18px_rgba(20,20,20,0.7)] animate-float sm:-left-10">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand">
                  <Goal className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold">Gol dicatat · 63&rsquo;</p>
                  <p className="truncate text-[11px] text-night-muted">#16 Hilmi Hakim (CPF)</p>
                </div>
              </div>
            </div>

            {/* standings card */}
            <div className="absolute -right-1 bottom-6 w-48 rounded-2xl bg-block-yellow p-3 text-ink shadow-[0_24px_50px_-18px_rgba(20,20,20,0.5)] animate-float-slow sm:-right-8">
              <p className="text-[10px] font-bold uppercase tracking-wider">Klasemen · KU-14</p>
              <ul className="mt-2 space-y-1">
                {STANDINGS.slice(0, 3).map((s, i) => (
                  <li key={s.short} className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="w-3 tabular-nums">{i + 1}</span>
                    <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.short}</span>
                    <span className="font-display text-sm leading-none">{s.pts}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Score ticker ───────────────────────────────────────────────── */}
      <section aria-label="Skor terkini" className="overflow-hidden py-4">
        <Ticker
          className="-rotate-2 bg-brand text-white"
          items={SCORES.map((s) => (
            <span key={s.text} className="flex items-center gap-3 whitespace-nowrap">
              {s.live && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-brand">LIVE</span>}
              <span className="font-display text-2xl uppercase tracking-wide">{s.text}</span>
              <span className="text-xs font-semibold">{s.meta}</span>
              <span className="text-white/60">✦</span>
            </span>
          ))}
        />
        <Ticker
          reverse
          className="-mt-1 rotate-1 bg-night text-white"
          items={MODULE_TICKER.map((m) => (
            <span key={m} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl uppercase tracking-wide">
              {m}
              <span className="text-brand">✦</span>
            </span>
          ))}
        />
      </section>

      {/* ── Numbers ────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 py-16 lg:grid-cols-4">
        {[
          ["7", "Modul kerja terintegrasi", BLOCK.red],
          ["4", "Format kompetisi", BLOCK.blue],
          ["8", "Tahap QA data impor", BLOCK.yellow],
          ["100%", "Proses dapat diaudit", BLOCK.night],
        ].map(([n, l, b]) => (
          <div key={l} className={cn("reveal flex min-h-[150px] flex-col justify-between rounded-[1.75rem] p-5 sm:p-6", b)}>
            <div className="font-display text-5xl leading-none tracking-wide sm:text-6xl">{n}</div>
            <div className="mt-4 text-sm font-semibold">{l}</div>
          </div>
        ))}
      </section>

      {/* ── Challenges ─────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionTitle
            kicker="Tantangan"
            title="Masalah yang kami selesaikan"
            body="Operasional sepak bola akar rumput masih bergantung pada spreadsheet, grup pesan, dan ingatan. Inilah yang kami ganti."
          />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CHALLENGES.map((c, i) => (
            <li key={c} className="reveal flex flex-col gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line/80">
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl leading-none text-brand">{String(i + 1).padStart(2, "0")}</span>
                <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand">
                  <X className="size-3.5" />
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-secondary">{c}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Pillars (bento) ────────────────────────────────────────────── */}
      <section id="pilar" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16">
        <SectionTitle
          kicker="Empat pilar"
          title="Empat pilar, satu sumber data"
          body="Seluruh pilar terhubung melalui satu lapisan data terpusat — setiap perubahan langsung tercermin di seluruh sistem tanpa sinkronisasi manual."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {/* Competition */}
          <article className={cn("reveal flex flex-col justify-between gap-8 rounded-[2rem] p-6 sm:p-8 lg:col-span-2 lg:row-span-2", BLOCK.red)}>
            <div>
              <span className="grid size-12 place-items-center rounded-full bg-white/20">
                <Trophy className="size-5" />
              </span>
              <h3 className="mt-6 font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">
                Competition Management
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed">
                Pengelolaan turnamen, format kompetisi, jadwal pertandingan, dan klasemen secara
                otomatis dan akurat.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-3 text-ink sm:p-4" aria-hidden>
              <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <span>Klasemen Grup A</span>
                <span className="flex gap-6 sm:gap-10">
                  <span>M</span>
                  <span>Poin</span>
                </span>
              </div>
              <ul className="space-y-1">
                {STANDINGS.map((s, i) => (
                  <li key={s.short} className={cn("flex items-center gap-3 rounded-2xl px-2 py-2", i < 2 ? "bg-brand-soft" : "bg-surface-2")}>
                    <span className="w-4 text-center font-display text-lg leading-none">{i + 1}</span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-bold" style={{ background: s.color }}>
                      {s.short}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                    <span className="flex gap-6 text-right tabular-nums sm:gap-10">
                      <span className="w-3 text-sm text-ink-muted">{s.p}</span>
                      <span className="w-6 font-display text-xl leading-none">{s.pts}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {/* Match ops */}
          <article className={cn("reveal flex flex-col justify-between gap-6 rounded-[2rem] p-6 sm:p-7", BLOCK.blue)}>
            <div>
              <span className="grid size-12 place-items-center rounded-full bg-white/20">
                <Radio className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-3xl uppercase leading-none tracking-wide">Real-Time Match Ops</h3>
              <p className="mt-2.5 text-sm leading-relaxed">
                Klik pemain, pilih kejadian — skor, statistik, dan klasemen ikut berubah.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-hidden>
              <span className="flex flex-col gap-2 rounded-2xl bg-brand p-2.5 text-[10px] font-bold text-white">
                <Goal className="size-4" /> Gol
              </span>
              <span className="flex flex-col gap-2 rounded-2xl bg-block-yellow p-2.5 text-[10px] font-bold text-ink">
                <span className="h-4 w-3 rotate-6 rounded-[2px] bg-[#ffc93c] ring-1 ring-black/15" /> Kartu
              </span>
              <span className="flex flex-col gap-2 rounded-2xl bg-block-pink p-2.5 text-[10px] font-bold text-ink">
                <ArrowLeftRight className="size-4" /> Ganti
              </span>
            </div>
          </article>

          {/* Player intelligence */}
          <article className={cn("reveal flex items-end justify-between gap-4 rounded-[2rem] p-6 sm:p-7", BLOCK.yellow)}>
            <div>
              <span className="grid size-12 place-items-center rounded-full bg-ink/10">
                <Radar className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-3xl uppercase leading-none tracking-wide">Player Intelligence</h3>
              <p className="mt-2.5 text-sm leading-relaxed">Radar performa dan riwayat karier jangka panjang.</p>
            </div>
            <svg viewBox="0 0 100 100" className="size-24 shrink-0" aria-hidden>
              {[40, 28, 16].map((r) => (
                <polygon
                  key={r}
                  points={[0, 1, 2, 3, 4, 5].map((k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.25}
                />
              ))}
              <polygon points="50,14 82,36 76,66 50,80 26,62 30,32" fill="#141414" fillOpacity={0.85} />
            </svg>
          </article>

          {/* AI scout */}
          <article className={cn("reveal flex flex-col gap-6 rounded-[2rem] p-6 sm:p-8 lg:col-span-3 lg:flex-row lg:items-center lg:justify-between", BLOCK.night)}>
            <div className="max-w-md">
              <span className="grid size-12 place-items-center rounded-full bg-white/10 text-brand">
                <Sparkles className="size-5" />
              </span>
              <h3 className="mt-5 font-display text-3xl uppercase leading-none tracking-wide sm:text-4xl">AI Talent Scout</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-night-muted">
                Pencarian dan evaluasi talenta berbasis kecerdasan buatan untuk keputusan scouting
                yang lebih objektif.
              </p>
            </div>
            <div className="w-full max-w-lg" aria-hidden>
              <div className="flex items-center gap-3 rounded-full bg-night-2 py-2 pl-5 pr-2 ring-1 ring-night-line">
                <Search className="size-4 shrink-0 text-night-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-white">Gelandang KU-15 kaki kiri, umpan kunci tinggi</span>
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
                    <span className="rounded-full bg-block-mint px-2 py-0.5 font-display text-sm leading-none">{s}</span>
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <section id="alur" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-16">
        <SectionTitle kicker="Alur kerja" title="Dari pendaftaran ke peluit akhir" />
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn("reveal relative flex min-h-[240px] flex-col justify-between rounded-[1.75rem] p-6", s.block)}>
              <div className="flex items-center justify-between">
                <span className="font-display text-6xl leading-none">0{i + 1}</span>
                <span className="grid size-11 place-items-center rounded-full bg-white/20 ring-1 ring-black/5">
                  <s.icon className="size-5" />
                </span>
              </div>
              <div>
                <h3 className="font-display text-3xl uppercase leading-none tracking-wide">{s.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed">{s.body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-3 top-1/2 z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full bg-base text-ink ring-1 ring-line lg:grid">
                  <ArrowRight className="size-3.5" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Modules ────────────────────────────────────────────────────── */}
      <section id="modul" className="mt-10 scroll-mt-28 rounded-t-[2.5rem] bg-night py-20 text-white sm:rounded-t-[3.5rem]">
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            dark
            kicker="Modul"
            title="Tujuh modul kerja"
            body="Dirancang mengikuti alur kerja nyata organisasi pengelola kompetisi, dari perencanaan hingga evaluasi pasca-pertandingan."
          />
          <div className="mt-10 space-y-[-14px]">
            {MODULES.map((m, i) => (
              <div
                key={m.name}
                className={cn(
                  "reveal relative flex flex-col gap-3 rounded-[2rem] px-6 pb-9 pt-6 transition-transform hover:-translate-y-1 sm:flex-row sm:items-end sm:justify-between sm:px-8",
                  m.block,
                )}
                style={{ zIndex: i }}
              >
                <div className="flex items-end gap-4">
                  <span className="font-display text-2xl leading-none opacity-60">0{i + 1}</span>
                  <h3 className="font-display text-3xl uppercase leading-none tracking-wide sm:text-5xl">{m.name}</h3>
                </div>
                <div className="flex items-center gap-3 sm:max-w-sm">
                  <p className="text-sm leading-relaxed">{m.desc}</p>
                  <m.icon className="size-6 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────────────────────── */}
      <section id="nilai" className="bg-night pb-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="reveal rounded-3xl bg-night-2 p-6 ring-1 ring-night-line">
                <span className="grid size-11 place-items-center rounded-full bg-brand text-white">
                  <v.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-night-muted">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Implementation ─────────────────────────────────────────────── */}
      <section id="implementasi" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20">
        <SectionTitle
          kicker="Implementasi"
          title="Siap dalam dua bulan"
          body="Direncanakan tuntas dalam 2 (dua) bulan sejak kick-off, terbagi ke dalam dua periode kerja utama."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {TIMELINE.map((t, i) => (
            <div key={t.phase} className={cn("reveal rounded-[2rem] p-7", i === 0 ? BLOCK.night : BLOCK.yellow)}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-6xl leading-none">0{i + 1}</span>
                <span className="text-xs font-semibold uppercase tracking-wider">{t.weeks}</span>
              </div>
              <h3 className="mt-6 font-display text-3xl uppercase leading-none tracking-wide">{t.phase}</h3>
              <p className="mt-3 text-sm leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-3 rounded-3xl bg-surface p-6 ring-1 ring-line/80 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <li key={d} className="flex items-start gap-2.5 text-sm text-ink-secondary">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                <Check className="size-3" />
              </span>
              {d}
            </li>
          ))}
        </ul>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-brand px-6 py-14 text-white sm:px-14">
          <div className="relative max-w-xl">
            <LogoChip logoClassName="h-14" />
            <h2 className="mt-8 font-display text-[44px] uppercase leading-[0.95] tracking-wide sm:text-6xl">
              Siap melihat {BRAND.name} bekerja?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white">
              Masuk ke lingkungan demo untuk menjelajahi seluruh tujuh modul dengan data kompetisi
              akar rumput yang lengkap.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-ink transition-colors hover:bg-base"
              >
                Masuk ke Platform <ArrowUpRight className="size-4" />
              </Link>
              <a
                href="#modul"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white/15 px-8 text-sm font-semibold text-white transition-colors hover:bg-white/25"
              >
                Tinjau modul
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="rounded-t-[2.5rem] bg-night text-night-muted sm:rounded-t-[3.5rem]">
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-14">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Logo className="h-28" />
              <p className="mt-5 max-w-sm text-sm leading-relaxed">
                {BRAND.tagline} — sistem operasi terpadu untuk kompetisi, data pemain, dan talenta
                sepak bola akar rumput Indonesia.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">Platform</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">Akses</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/login" className="transition-colors hover:text-white">
                    Masuk ke platform
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
            <span>Dokumen Rahasia & Terbatas</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
