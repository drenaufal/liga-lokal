"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const FILLS: Record<string, string> = {
  natural: "bg-block-jade", artificial: "bg-block-sky", hybrid: "bg-block-iris", futsal: "bg-block-coral",
};

export function VenueCover({ photoUrl, name, surface, children }: {
  photoUrl: string | null; name: string; surface: string; children: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative flex h-32 items-center justify-center overflow-hidden", FILLS[surface] ?? "bg-block-yellow")}>
      <div aria-hidden="true" className="relative h-24 w-44 rounded-xl border-2 border-ink/20">
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink/20" />
        <span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/20" />
        <span className="absolute left-0 top-1/2 h-12 w-6 -translate-y-1/2 rounded-r border-2 border-l-0 border-ink/20" />
        <span className="absolute right-0 top-1/2 h-12 w-6 -translate-y-1/2 rounded-l border-2 border-r-0 border-ink/20" />
      </div>
      {photoUrl && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} />
      )}
      <div className="absolute inset-x-4 top-4 flex justify-between gap-2">{children}</div>
    </div>
  );
}
