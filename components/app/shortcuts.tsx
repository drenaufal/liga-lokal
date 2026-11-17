"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";

const JUMPS: [string, string, string][] = [
  ["g c", "Command Center", "/command-center"],
  ["g r", msg("Registry — Pemain"), "/registry/pemain"],
  ["g k", msg("Kompetisi"), "/kompetisi"],
  ["g m", "Match Operations", "/match-ops"],
  ["g p", "Player Intelligence", "/player-intelligence"],
  ["g a", "AI Scout", "/ai-scout"],
  ["g i", "Data Ingestion", "/ingestion"],
];

export function ShortcutsButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const seq = React.useRef<string>("");
  const seqTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === "?") {
        setOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      seq.current += e.key.toLowerCase();
      if (seqTimer.current) clearTimeout(seqTimer.current);
      seqTimer.current = setTimeout(() => (seq.current = ""), 800);
      const match = JUMPS.find(([k]) => k.replace(" ", "") === seq.current);
      if (match) {
        seq.current = "";
        router.push(match[2]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("Pintasan keyboard (?)")}
        className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        <HelpCircle className="size-4" />
      </button>
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-night/50 backdrop-blur-[2px] animate-fade-in"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-10 w-full max-w-md rounded-3xl bg-surface p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.45)] animate-pop-in">
              <button
                onClick={() => setOpen(false)}
                aria-label={t("Tutup")}
                className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-surface-2 text-ink-muted hover:bg-elevated hover:text-ink"
              >
                <X className="size-4" />
              </button>
              <h2 className="font-display text-2xl uppercase leading-none text-ink">{t("Pintasan keyboard")}</h2>
              <p className="mt-1.5 text-xs text-ink-muted">
                {t("Navigasi cepat untuk pengguna operasional.")}
              </p>
              <div className="mt-4 space-y-1.5">
                <Row keys={["⌘", "K"]} label={t("Palet perintah / pencarian global")} />
                {JUMPS.map(([k, label]) => (
                  <Row key={k} keys={k.split(" ")} label={t.dyn(label)} />
                ))}
                <Row keys={["?"]} label={t("Buka panel pintasan ini")} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs hover:bg-surface-2">
      <span className="text-ink-secondary">{label}</span>
      <span className="flex gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="min-w-[22px] rounded-md bg-night px-1.5 py-0.5 text-center text-[10px] font-semibold text-white"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}
