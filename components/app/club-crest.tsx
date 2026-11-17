"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { crestTint } from "@/lib/crest";

/**
 * SSB badge. With an uploaded logo: the logo on a white, softly shadowed disc. Without one — or if
 * the image fails — a club badge made from the short name: a gradient in the tint picked from it
 * (see lib/crest.ts), a medal ring and the initials in the headline font.
 *
 * `size` is pixels, or any CSS length — `"var(--crest)"` lets a parent make the badge bigger on
 * wider screens. Every detail (ring, shadow, lettering) scales with it, so it also reads well at
 * the small sizes used in tables.
 */
export function ClubCrest({
  logoUrl,
  short,
  size = 24,
  className,
}: {
  logoUrl?: string | null;
  short?: string | null;
  size?: number | string;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  const side = typeof size === "number" ? `${size}px` : size;
  /** A length that follows the badge: `part(0.1)` is a tenth of its width. */
  const part = (n: number) => `calc(${side} * ${n})`;
  const lift = `0 ${part(0.07)} ${part(0.18)} ${part(-0.07)} rgb(0 0 0 / 0.45)`;

  if (logoUrl && !errored) {
    return (
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_22%,#ffffff_0%,#eceef1_100%)] ring-1 ring-black/10",
          className,
        )}
        style={{ width: side, height: side, boxShadow: lift }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={short ?? "Logo SSB"}
          className="absolute inset-[8%] h-[84%] w-[84%] object-contain"
          onError={() => setErrored(true)}
        />
      </span>
    );
  }

  const tint = crestTint(short);
  const letters = (short ?? "?").trim() || "?";
  // Fewer letters can be bigger; the headline font is narrow, so four still fit comfortably.
  const scale = letters.length <= 3 ? 0.46 : letters.length === 4 ? 0.38 : 0.3;
  const light = tint.fg === "#ffffff";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-headline uppercase leading-none tracking-wide",
        className,
      )}
      style={{
        width: side,
        height: side,
        color: tint.fg,
        background: `radial-gradient(circle at 30% 22%, color-mix(in srgb, ${tint.bg} 58%, white) 0%, ${tint.bg} 52%, color-mix(in srgb, ${tint.bg} 80%, black) 100%)`,
        boxShadow: `${lift}, inset 0 0 0 max(1.5px, ${part(0.04)}) rgb(255 255 255 / 0.4)`,
      }}
    >
      {/* the medal ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[11%]"
        style={{
          borderRadius: "inherit",
          border: `max(1px, ${part(0.014)}) solid color-mix(in srgb, ${tint.fg} 30%, transparent)`,
        }}
      />
      <span
        className="relative"
        style={{
          fontSize: `max(9px, ${part(scale)})`,
          textShadow: light ? "0 0.06em 0.12em rgb(0 0 0 / 0.3)" : "0 0.04em 0 rgb(255 255 255 / 0.35)",
        }}
      >
        {letters}
      </span>
    </span>
  );
}
