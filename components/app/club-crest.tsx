"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { crestTint } from "@/lib/crest";

/**
 * SSB logo when one has been uploaded, otherwise the short name on a tint
 * picked from it (see lib/crest.ts). Falls back automatically if the image fails.
 */
export function ClubCrest({
  logoUrl,
  short,
  size = 24,
  className,
}: {
  logoUrl?: string | null;
  short?: string | null;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  const radius = "rounded-full";

  if (logoUrl && !errored) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden border border-line bg-surface",
          radius,
          className,
        )}
        style={{ width: size, height: size, padding: Math.max(1, size * 0.14) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={short ?? "Logo SSB"}
          className="max-h-full max-w-full object-contain"
          onError={() => setErrored(true)}
        />
      </span>
    );
  }

  const tint = crestTint(short);
  return (
    <span
      className={cn("grid shrink-0 place-items-center font-bold", radius, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.36)),
        background: tint.bg,
        color: tint.fg,
      }}
    >
      {short ?? "?"}
    </span>
  );
}
