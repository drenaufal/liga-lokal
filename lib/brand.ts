/** Single source of truth for product naming. */
export const BRAND = {
  name: "LigaLokal",
  domain: "liga-lokal.id",
  url: "https://www.liga-lokal.id",
  tagline: "Unified Football Intelligence Platform",
  owner: "PT DVONES Indonesia",
  /** Website logo (white lettering — use on dark surfaces, see components/brand/logo.tsx). */
  logo: "/logo-font-putih.png",
  logoSize: { width: 842, height: 595 },
  /** Browser / install colours, mirroring the tokens in app/globals.css. */
  colors: { base: "#f2f0ec", night: "#151515", brand: "#e4222d" },
} as const;
