import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Activity, Radar, Trophy, Users } from "lucide-react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { getI18n } from "@/lib/i18n/server";
import { msg } from "@/lib/i18n/translate";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Masuk") };
}

/*
  Login artwork lives in /public/login (extracted from the design file):
  hero-celebration.webp and player-1..4.webp (transparent cut-outs).
  `height` is the cut-out's height as a share of its circle, so the four
  characters keep the proportions of the design.

  The page is locked to one viewport on desktop (h-dvh, no scroll), so every
  size on the brand panel is derived from the viewport height with clamp().
*/
const players = [
  { src: "/login/player-1.webp", bg: "bg-[#4361ee]", height: "197.6%" },
  { src: "/login/player-2.webp", bg: "bg-brand", height: "179%" },
  { src: "/login/player-3.webp", bg: "bg-[#ffc93d]", height: "190%" },
  { src: "/login/player-4.webp", bg: "bg-[#f4a6e8]", height: "190%" },
];

const highlights = [
  {
    icon: Trophy,
    text: msg("Turnamen dengan banyak KU — format Liga & Cup, jadwal manual atau unggah"),
    tone: "bg-[#4361ee] text-white",
  },
  {
    icon: Activity,
    text: msg("Operasional pertandingan real-time — klik pemain, catat kejadian"),
    tone: "bg-brand text-white",
  },
  {
    icon: Radar,
    text: msg("Player Intelligence dengan radar performa"),
    tone: "bg-[#ffc93d] text-ink",
  },
  {
    icon: Users,
    text: msg("Satu sumber data untuk pemain, klub, pelatih, wasit & venue"),
    tone: "bg-[#f4a6e8] text-ink",
  },
];

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-dvh bg-base lg:h-dvh lg:grid-cols-[908fr_1012fr] lg:overflow-hidden">
      {/* Brand panel */}
      <div className="relative hidden h-full min-h-0 overflow-hidden rounded-br-[clamp(4rem,10vh,8rem)] bg-[#1b1919] text-white lg:block">
        {/* Colour glows */}
        <div aria-hidden className="pointer-events-none absolute -right-[18%] -top-[14%] size-[70%] rounded-full bg-brand/45 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-[22%] -left-[16%] size-[64%] rounded-full bg-[#4361ee]/40 blur-[120px]" />

        {/* Hero photo — lightened into the dark panel and faded out at the bottom */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/login/hero-celebration.webp"
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-x-0 top-0 h-[60%] w-full select-none object-cover object-top opacity-55 mix-blend-lighten [mask-image:linear-gradient(to_bottom,#000_45%,transparent)]"
        />
        {/* Oversized logo watermark — only its red ball bleeds into the panel */}
        <Logo
          title=""
          className="pointer-events-none absolute left-[69.4%] top-[75%] h-auto w-[85%] mix-blend-color"
        />

        <div className="relative flex h-full flex-col justify-between gap-[1.6vh] px-[clamp(1.5rem,3.7vw,4rem)] py-[clamp(1rem,3.2vh,2.25rem)]">
          <div>
            <div className="flex items-center justify-between">
              <Link href="/" aria-label={t("Beranda {brand}", { brand: BRAND.name })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/logo-dark.png"
                  alt={BRAND.name}
                  width={BRAND.logoSize.width}
                  height={BRAND.logoSize.height}
                  draggable={false}
                  className="block h-[clamp(3.25rem,10vh,6.5rem)] w-auto max-w-none select-none"
                />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#ffc93d]"
              >
                <ArrowLeft className="size-3.5" />
                {t("Beranda")}
              </Link>
            </div>

            <div className="mt-[clamp(0.5rem,2.6vh,2rem)] max-w-[34rem]">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-[#ffc93d]" />
                {t("Sistem Operasi Sepak Bola Akar Rumput")}
              </p>
              <h2 className="mt-[1.6vh] font-headline text-[clamp(2.4rem,min(3.7vw,6.6vh),4.4rem)] uppercase leading-[0.94]">
                {t("Satu platform untuk kompetisi, pemain & talenta.")}
              </h2>
              <p className="mt-[1.6vh] max-w-[30rem] text-[13px] font-medium leading-snug text-white/75 [@media(max-height:820px)]:hidden">
                {t(
                  "{brand} menyatukan operator turnamen, wasit, pelatih, dan pemandu bakat dalam satu ruang kerja digital yang terhubung dan dapat diaudit.",
                  { brand: BRAND.name },
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-[clamp(0.6rem,2vh,1.25rem)]">
            <div className="flex items-end justify-between">
              {players.map((p) => (
                <div
                  key={p.src}
                  className={`relative size-[min(17vh,9.4vw)] shrink-0 overflow-hidden rounded-full shadow-[0_14px_28px_-12px_rgba(0,0,0,0.6)] ring-4 ring-white/10 ${p.bg}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt=""
                    aria-hidden
                    draggable={false}
                    style={{ height: p.height }}
                    className="pointer-events-none absolute left-1/2 top-[4.3%] w-auto max-w-none -translate-x-1/2 select-none"
                  />
                </div>
              ))}
            </div>

            <ul className="grid grid-cols-2 gap-2 [@media(max-height:640px)]:hidden">
              {highlights.map((h) => (
                <li
                  key={h.text}
                  className={`flex items-center gap-2.5 rounded-2xl px-3 py-[clamp(0.4rem,1.2vh,0.65rem)] text-[clamp(10px,1.55vh,12px)] font-semibold leading-snug ${h.tone}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-brand">
                    <h.icon className="size-3.5" />
                  </span>
                  {t.dyn(h.text)}
                </li>
              ))}
            </ul>

            <p className="text-[9px] font-semibold uppercase leading-snug tracking-[0.18em] text-white/55">
              © {new Date().getFullYear()} {BRAND.owner} · {t("Dokumen Rahasia & Terbatas")}
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex min-h-0 overflow-y-auto overflow-x-hidden px-6 py-[clamp(1rem,3vh,2rem)]">
        {/* Soft colour shapes behind the form — clipped so they never add scroll height */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-[#ffc93d]" />
          <div className="absolute -bottom-28 -left-16 size-64 rounded-full bg-[#4361ee]/15" />
          <div className="absolute -bottom-10 -right-10 size-32 rounded-full bg-brand/20" />
        </div>
        <LanguageSwitcher tone="light" className="absolute right-4 top-4 z-10 lg:right-8 lg:top-6" />
        <React.Suspense>
          <LoginForm />
        </React.Suspense>
      </div>
    </main>
  );
}
