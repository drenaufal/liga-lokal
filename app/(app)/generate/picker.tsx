"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PickerStep = {
  /** URL parameter of this step. */
  param: string;
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  /** Shown instead of the select while an earlier step is still open. */
  disabledText?: string;
};

/**
 * Numbered selects (Turnamen → SSB / KU). Each choice goes into the URL, and picking an earlier
 * step clears the ones after it, so the server page always renders a consistent selection.
 */
export function GeneratePicker({ steps }: { steps: PickerStep[] }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = React.useTransition();

  const choose = (index: number, value: string) => {
    const params = new URLSearchParams();
    steps.slice(0, index).forEach((s) => s.value && params.set(s.param, s.value));
    if (value) params.set(steps[index].param, value);
    start(() => router.push(`${path}${params.size ? `?${params}` : ""}`));
  };

  return (
    <div className={cn("grid gap-3", steps.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
      {steps.map((s, i) => {
        const locked = i > 0 && !steps[i - 1].value;
        return (
          <div key={s.param} className="min-w-0">
            <label htmlFor={`pick-${s.param}`} className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink-secondary">
              <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold", s.value ? "bg-night text-white" : "bg-surface-2 text-ink-muted")}>
                {i + 1}
              </span>
              {s.label}
              {pending && i === steps.findIndex((x) => !x.value) - 1 && <Loader2 className="size-3 animate-spin text-ink-muted" />}
            </label>
            <Select
              id={`pick-${s.param}`}
              value={s.value}
              disabled={locked || pending}
              onChange={(e) => choose(i, e.target.value)}
              className="w-full"
            >
              <option value="">{locked ? (s.disabledText ?? s.placeholder) : s.placeholder}</option>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        );
      })}
    </div>
  );
}
