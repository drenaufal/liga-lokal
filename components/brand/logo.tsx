import * as React from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/*
  LigaLokal logo — the official artwork in /public/logo-font-putih.png:
  the red ball with the white "liga lokal.id" lettering and the web address,
  on a transparent background.

  The lettering is white, so the logo belongs on a dark surface (the sidebar,
  the footer, the login panel). On a light surface put it in a <LogoChip>,
  a night-coloured pill, so the lettering stays readable.

  Size it with a height class (h-10, h-16 …); the width follows the artwork.
*/

export function Logo({
  className,
  title = BRAND.name,
}: {
  className?: string;
  /** Accessible name. Pass "" when the logo is purely decorative. */
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logo}
      alt={title}
      aria-hidden={title ? undefined : true}
      width={BRAND.logoSize.width}
      height={BRAND.logoSize.height}
      decoding="async"
      draggable={false}
      className={cn("block h-10 w-auto max-w-none shrink-0 select-none", className)}
    />
  );
}

/** The logo on a night-coloured pill — for light surfaces (top bar, menus, cards). */
export function LogoChip({
  className,
  logoClassName,
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-night px-3 py-1 shadow-[0_8px_20px_-12px_rgba(20,20,20,0.7)]",
        className,
      )}
    >
      <Logo className={cn("h-9", logoClassName)} />
    </span>
  );
}
