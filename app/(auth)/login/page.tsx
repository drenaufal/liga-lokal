import * as React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Activity, Radar, Trophy, Users } from "lucide-react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Masuk" };

const highlights = [
  { icon: Trophy, text: "Turnamen dengan banyak KU — format Liga & Cup, jadwal manual atau unggah" },
  { icon: Activity, text: "Operasional pertandingan real-time — klik pemain, catat kejadian" },
  { icon: Radar, text: "Player Intelligence dengan radar performa" },
  { icon: Users, text: "Satu sumber data untuk pemain, klub, pelatih, wasit & venue" },
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-base lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — dark, so the white lettering of the logo stays readable */}
      <div className="relative hidden overflow-hidden bg-night text-white lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-brand/30 blur-3xl"
        />
        <Logo
          title=""
          className="pointer-events-none absolute -bottom-36 -right-32 h-[620px] opacity-[0.07]"
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label={`Beranda ${BRAND.name}`}>
              <Logo className="h-24" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25"
            >
              <ArrowLeft className="size-3.5" />
              Beranda
            </Link>
          </div>

          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              Sistem Operasi Sepak Bola Akar Rumput
            </p>
            <h2 className="mt-4 font-display text-6xl uppercase leading-[0.92] tracking-wide">
              Satu platform untuk kompetisi, pemain & talenta.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-white">
              {BRAND.name} menyatukan operator turnamen, wasit, pelatih, dan pemandu bakat dalam
              satu ruang kerja digital yang terhubung dan dapat diaudit.
            </p>
            <ul className="mt-8 space-y-2.5">
              {highlights.map((h) => (
                <li key={h.text} className="flex items-center gap-3 rounded-2xl bg-white/12 px-3 py-2.5 text-sm font-medium">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand">
                    <h.icon className="size-4" />
                  </span>
                  {h.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-white">
            © {new Date().getFullYear()} {BRAND.owner} · Dokumen Rahasia & Terbatas
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <React.Suspense>
          <LoginForm />
        </React.Suspense>
      </div>
    </main>
  );
}
