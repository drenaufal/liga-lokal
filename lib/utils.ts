import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Formatting helpers (id-ID locale) ─────────────────────────────── */

/**
 * Every date is shown in WIB regardless of where the code runs. Without this a
 * server in UTC (Hostinger) would render kick-off times 7 hours early, and the
 * browser could disagree with the server on hydration.
 */
export const APP_TIME_ZONE = "Asia/Jakarta";

export function formatDate(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: APP_TIME_ZONE, ...opts }).format(new Date(date));
}

export function formatDateTime(date: Date | string | number) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatTime(date: Date | string | number) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("id-ID", opts).format(n);
}

export function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeTime(date: Date | string | number) {
  const d = new Date(date).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "";
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

export function ageFromDob(dob: Date | string) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Deterministic avatar URL fallback when Cloudinary is not configured. */
export function avatarUrl(name: string, seed?: string) {
  const s = encodeURIComponent(seed ?? name);
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${s}&backgroundColor=0f1620`;
}

/** Deterministic club-crest fallback. */
export function crestUrl(name: string) {
  const s = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${s}&backgroundColor=141d29`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function pct(value: number, total: number) {
  if (!total) return 0;
  return clamp(value / total, 0, 1);
}
