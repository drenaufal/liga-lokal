"use client";

import { usePathname } from "next/navigation";
import { FilterSelect } from "@/components/app/list-controls";

/**
 * "Unit bisnis" filter for people who can see every unit. It writes ?unit=CODE, which every
 * Keuangan page reads. Hidden on the unit list itself, where it would mean nothing.
 */
export function UnitFilter({
  label,
  allLabel,
  options,
}: {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/keuangan/unit")) return null;
  return (
    <div className="mb-4 flex items-center justify-end gap-2">
      <span className="shrink-0 text-xs font-medium text-ink-muted">{label}</span>
      <FilterSelect param="unit" placeholder={allLabel} options={options} />
    </div>
  );
}
