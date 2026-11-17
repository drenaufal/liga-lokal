"use client";

import * as React from "react";
import { Check, Search, UserX, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export type PickerItem = {
  id: string;
  name: string;
  /** Second line: license level, city, role… */
  subtitle?: string;
  photo?: string | null;
  badge?: { label: string; tone?: React.ComponentProps<typeof Badge>["tone"] };
  /** Shown but not selectable (e.g. an account that is no longer active). */
  unavailable?: string;
};

/**
 * Searchable list for choosing a person (wasit, operator, pelatih). One component
 * so every selector looks and behaves the same: a summary of what is chosen,
 * a search box once the list is long, and large tap targets for each row.
 */
export function PersonPicker({
  legend,
  icon,
  items,
  value,
  onChange,
  mode,
  disabled,
  emptyText,
  placeholder,
  noneLabel,
  help,
  maxListHeight = "max-h-64",
}: {
  legend: string;
  icon?: React.ReactNode;
  items: PickerItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  mode: "single" | "multi";
  disabled?: boolean;
  emptyText?: string;
  placeholder?: string;
  noneLabel?: string;
  help?: string;
  maxListHeight?: string;
}) {
  const t = useT();
  const [query, setQuery] = React.useState("");
  const emptyLabel = emptyText ?? t("Belum ada data.");
  const noneText = noneLabel ?? t("Belum dipilih");
  const uid = React.useId();
  const q = query.trim().toLowerCase();
  const visible = q
    ? items.filter((i) => `${i.name} ${i.subtitle ?? ""}`.toLowerCase().includes(q))
    : items;
  const selected = value.map((id) => items.find((i) => i.id === id)).filter((i): i is PickerItem => !!i);

  const toggle = (id: string) => {
    if (mode === "single") onChange(value[0] === id ? [] : [id]);
    else onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2.5">
      <legend className="mb-2 flex h-6 w-full items-center gap-1.5 text-xs font-semibold text-ink-secondary">
        {icon}
        {legend}
        {mode === "multi" && (
          <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] tabular-nums text-ink-muted">
            {t("{n} dipilih", { n: value.length })}
          </span>
        )}
      </legend>

      {/* What is chosen right now */}
      {mode === "single" ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5",
            selected[0] ? "border-brand/30 bg-brand-soft" : "border-dashed border-line bg-surface-2",
          )}
        >
          {selected[0] ? (
            <>
              <Avatar src={selected[0].photo} name={selected[0].name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{selected[0].name}</p>
                {selected[0].subtitle && <p className="truncate text-[11px] text-ink-secondary">{selected[0].subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => onChange([])}
                aria-label={t("Hapus pilihan {name}", { name: selected[0].name })}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
                <UserX className="size-4" />
              </span>
              <p className="text-sm text-ink-muted">{noneText}</p>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex h-[58px] flex-wrap content-center items-center gap-1.5 overflow-y-auto rounded-xl border px-3 py-2",
            selected.length ? "border-brand/30 bg-brand-soft/40" : "border-dashed border-line bg-surface-2",
          )}
          aria-live="polite"
        >
          {selected.length ? (
            selected.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-1 pr-1.5 text-xs font-semibold text-ink"
              >
                <Avatar src={p.photo} name={p.name} size={22} />
                {p.name}
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-label={t("Hapus {name}", { name: p.name })}
                  className="grid size-5 place-items-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          ) : (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
                <UserX className="size-4" />
              </span>
              <p className="text-sm text-ink-muted">{noneText}</p>
            </>
          )}
        </div>
      )}

      {/* Always shown so side-by-side pickers line up */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t("Cari nama…")}
          aria-label={t("Cari {what}", { what: legend.toLowerCase() })}
          className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
      </div>

      <div
        role={mode === "single" ? "radiogroup" : "group"}
        aria-label={legend}
        className={cn("space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-1.5", maxListHeight)}
      >
        {visible.map((p) => {
          const checked = value.includes(p.id);
          const blocked = !!p.unavailable && !checked;
          return (
            <label
              key={p.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40",
                checked ? "bg-brand-soft" : "hover:bg-surface-2",
                blocked && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                name={mode === "single" ? uid : undefined}
                checked={checked}
                disabled={blocked}
                // a radio cannot be unticked by clicking it again; handle that on click
                onChange={() => (mode === "multi" || !checked) && toggle(p.id)}
                onClick={() => mode === "single" && checked && toggle(p.id)}
                className="sr-only"
              />
              <Avatar src={p.photo} name={p.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                {(p.subtitle || p.unavailable) && (
                  <span className="block truncate text-[11px] text-ink-muted">{p.unavailable ?? p.subtitle}</span>
                )}
              </span>
              {p.badge && !p.unavailable && <Badge tone={p.badge.tone}>{p.badge.label}</Badge>}
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center border-2 transition-colors",
                  mode === "single" ? "rounded-full" : "rounded-md",
                  checked ? "border-brand bg-brand text-white" : "border-line bg-surface text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </label>
          );
        })}
        {!visible.length && (
          <p className="px-3 py-5 text-center text-xs text-ink-muted">
            {items.length ? t("Tidak ada hasil untuk “{query}”.", { query }) : emptyLabel}
          </p>
        )}
      </div>
      {help && <p className="text-[11px] text-ink-muted">{help}</p>}
    </fieldset>
  );
}
