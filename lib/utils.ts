import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Dates, numbers and relative times are formatted per language by `fmt` (lib/i18n/format.ts). */
export { APP_TIME_ZONE } from "@/lib/i18n/format";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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
