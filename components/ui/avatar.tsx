"use client";

import * as React from "react";
import { cn, initials as toInitials } from "@/lib/utils";

const PALETTE = [
  ["#fde8e9", "#c2141f"],
  ["#e3e8ff", "#2f47c9"],
  ["#fff1c7", "#8a5a00"],
  ["#ece9ff", "#5a3fd1"],
  ["#ffe3f1", "#b0166d"],
  ["#dcf7e3", "#13703a"],
  ["#ffe6d9", "#b8460f"],
  ["#e9e6df", "#3d3a35"],
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  src,
  name,
  size = 36,
  square,
  fit = "cover",
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  square?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  const show = src && !errored;
  const [bg, fg] = PALETTE[hash(name) % PALETTE.length];
  const ini = toInitials(name);

  return (
    <div
      style={{ width: size, height: size, background: show ? "var(--color-surface-2)" : bg }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        square ? "rounded-lg" : "rounded-full",
        className,
      )}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className={cn("absolute inset-0 h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
          onError={() => setErrored(true)}
        />
      ) : (
        <span
          className="font-bold leading-none"
          style={{ fontSize: Math.max(9, size * 0.38), color: fg }}
        >
          {ini}
        </span>
      )}
    </div>
  );
}
